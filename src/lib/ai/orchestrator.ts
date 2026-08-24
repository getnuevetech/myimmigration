import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type ChatMessage, type MediaAttachment } from "./adapters";
import { mergeStructured, computeReadiness, type Conflict } from "./consensus";
import { fallbackAnalyze } from "./fallback";
import { STAGE_KEYS } from "../constants";
import { getNumberSetting } from "../settings";
import { readUpload } from "../uploads";
import { retrieveUnifiedAuthority, snapshotAuthorityForPlan } from "../authority-retrieval";
import { buildPrimaryReasonerContext } from "../primary-reasoner-context";
import { buildCaseActionGraph } from "../action-graph";
import { buildCasePresentation, getCasePresentationBrief } from "../case-presentation";
import { verifyCaseProgress } from "../case-progress";
import { ensureCaseVersion, failCaseVersion, finalizeCaseVersion } from "../case-versioning";
import { buildCanonicalApprovedState } from "../canonical-case-state";
import { parsePresentationRecord } from "../case-presentation-contract";
import {
  analysisRunDecisions,
  buildPlanExecution,
  parseAnalysisPlan,
  runtimeQuestionAddition,
  runtimeReviewAddition,
  withPlanExecution,
  type AnalysisIssueHint,
  type AnalysisPlan,
} from "../case-analysis-plan";
import { createCaseAnalysisPlan, finishAnalysisPlan, markAnalysisPlanRunning } from "../case-orchestrator";
import { planCaseQuestions } from "../question-planner";
import { processDocumentsEvidence } from "../evidence/document-processing";
import { rebuildCaseEvidenceState } from "../evidence/case-state";
import { getCaseEvidenceGateBrief } from "../evidence/case-gate";
import { getCaseEvidenceBrief } from "../evidence/brief";
import { guardLetterDraftWithEvidence } from "../evidence/letter-guard";
import { mergeSupportedText, presentationGroundingBlock, withPresentationNoticeSteps } from "../case-presentation-brief";
import { formatKnowledgeBlock, type KnowledgeRecord } from "../knowledge-retrieval";
import { buildQaFallbackAnswer, classifyImmigrationInquiry, authorityQueriesForInquiry } from "../immigration-inquiry";

type Json = Record<string, unknown>;

const USCIS_REFERENCE_RE = /\b(?:RFE|NOID|NOIR|NOIT|I-797C?|I-485|I-130|I-765|I-864|I-589|N-400|G-28|AR-11|BIOMETRICS|INTERVIEW|DENIAL|APPROVAL|[A-Z]{3}\d{10})\b/gi;

function normalizeActionKey(value: unknown): string {
  const key = String(value ?? "").toUpperCase();
  const aliases: Record<string, string> = {
    GET_TRANSCRIPT: "GET_CASE_RECORD",
    GET_ACCOUNT_TRANSCRIPT: "GET_ACCOUNT_RECORD",
    COMPLETE_FORM_9465: "COMPLETE_FORM_I485",
    BUILD_TIMELINE: "GET_CASE_RECORD",
    PRO_REVIEW: "REVIEW_ANALYSIS",
  };
  const normalized = aliases[key] ?? key;
  const allowed = new Set([
    "UPLOAD_DOCUMENTS",
    "UPLOAD_NOTICE",
    "GET_CASE_RECORD",
    "GET_ACCOUNT_RECORD",
    "ADD_DEADLINE",
    "DRAFT_LETTER",
    "COMPLETE_FORM_I485",
    "REVIEW_ANALYSIS",
    "RERUN_ANALYSIS",
    "PREPARE_APPOINTMENT",
    "ADD_CASE_DETAILS",
  ]);
  return allowed.has(normalized) ? normalized : "";
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

async function getRunnableSteps(stageKey: string) {
  const stage = await db.pipelineStage.findUnique({
    where: { key: stageKey },
    include: {
      steps: {
        where: { isEnabled: true },
        orderBy: { sortOrder: "asc" },
        include: { provider: true },
      },
    },
  });
  if (!stage?.isEnabled) return [];
  return stage.steps.filter((s) => s.provider.isEnabled && s.provider.apiKey.length > 0);
}

// Ranked retrieval over the unified authority path (registry + knowledge + match stats).
export async function retrieveKnowledgeRecords(query: string, limit = 5, caseId?: string | null): Promise<KnowledgeRecord[]> {
  const inquiry = classifyImmigrationInquiry({ situation: query, goal: query });
  return retrieveUnifiedAuthority({
    query,
    queries: authorityQueriesForInquiry(inquiry),
    inquiryMode: inquiry.mode,
    themes: inquiry.themes,
    caseId,
    limit,
    persistHits: true,
    preferSnapshots: Boolean(caseId),
  });
}

export async function retrieveKnowledge(query: string, limit = 5): Promise<string> {
  return formatKnowledgeBlock(await retrieveKnowledgeRecords(query, limit));
}

export type StageOutcome = {
  stepOutputs: { source: string; role: string; data: Json | null; rawText: string }[];
  merged: Json;
  conflicts: Conflict[];
  usedAi: boolean;
};

const EMPTY_STAGE: StageOutcome = { stepOutputs: [], merged: {}, conflicts: [], usedAi: false };

/**
 * Run one pipeline stage: every enabled step (each an admin-selected provider
 * with an admin-editable prompt and responsibility) runs on the same input,
 * then the consensus engine merges results and flags disagreements.
 */
export async function runStage(
  stageKey: string,
  vars: Record<string, string>,
  opts?: { runId?: string; sequentialContext?: boolean; media?: MediaAttachment[]; roles?: string[] },
): Promise<StageOutcome> {
  const allowedRoles = opts?.roles ? new Set(opts.roles) : null;
  const steps = (await getRunnableSteps(stageKey)).filter((step) => !allowedRoles || allowedRoles.has(step.role));
  const stepOutputs: StageOutcome["stepOutputs"] = [];
  let prior = "";

  async function runOneStep(step: (typeof steps)[number], stepPrior: string): Promise<StageOutcome["stepOutputs"][number] | null> {
    const prompt = fill(step.promptTemplate, { ...vars, prior: stepPrior });
    const messages: ChatMessage[] = [{ role: "user", content: prompt }];
    const started = Date.now();
    try {
      const result = await callProvider(step.provider, messages, opts?.media ?? []);
      const data = extractJson(result.text);
      const output = {
        source: `${step.provider.name} (${step.role})`,
        role: step.role,
        data,
        rawText: result.text,
      };
      if (opts?.runId) {
        await db.analysisStepResult.create({
          data: {
            runId: opts.runId,
            providerId: step.providerId,
            roleKey: step.role,
            status: "complete",
            rawText: result.text.slice(0, 20000),
            parsedJson: data ? JSON.stringify(data) : "",
            latencyMs: result.latencyMs,
          },
        });
      }
      return output;
    } catch (err) {
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed in stage "${stageKey}" (${step.role})`, String(err));
      if (opts?.runId) {
        await db.analysisStepResult.create({
          data: {
            runId: opts.runId,
            providerId: step.providerId,
            roleKey: step.role,
            status: "failed",
            rawText: String(err).slice(0, 2000),
            latencyMs: Date.now() - started,
          },
        });
      }
      return null;
    }
  }

  if (opts?.sequentialContext) {
    for (const step of steps) {
      const output = await runOneStep(step, prior);
      if (output) {
        stepOutputs.push(output);
        prior += `\n\n[${output.role}]\n${output.rawText}`;
      }
    }
  } else {
    const outputs = await Promise.all(steps.map((step) => runOneStep(step, "")));
    stepOutputs.push(...outputs.filter((output): output is StageOutcome["stepOutputs"][number] => Boolean(output)));
  }

  const structured = stepOutputs.filter((o) => o.data);
  const { merged, conflicts } = mergeStructured(
    structured.map((o) => ({ source: o.source, data: o.data as Json })),
  );
  return { stepOutputs, merged, conflicts, usedAi: stepOutputs.length > 0 };
}

// ---------- Full case analysis pipeline (Layers 1–5) ----------

// Extract readable text from an uploaded document: plain-text formats
// directly, and digital PDFs (like USCIS case records downloaded from the online
// account) via their embedded text layer. Scanned PDFs and photos have no
// text layer — they go to vision-capable providers as media instead.
async function getDocumentText(doc: { filePath: string; fileName: string; mimeType: string; extractedJson?: string }): Promise<string> {
  if (doc.extractedJson) {
    try {
      const parsed = JSON.parse(doc.extractedJson);
      const rawText = typeof parsed?.raw_text === "string" ? parsed.raw_text.trim() : "";
      if (rawText.length > 80) return rawText.slice(0, 15000);
    } catch {
      // Fall through to reading the upload.
    }
  }
  const textLike =
    doc.mimeType.startsWith("text/") ||
    /\.(txt|csv|md|log)$/i.test(doc.fileName) ||
    doc.mimeType === "application/json";
  const isPdf = doc.mimeType === "application/pdf" || /\.pdf$/i.test(doc.fileName);
  try {
    const buf = await readUpload(doc.filePath);
    if (textLike) return buf.toString("utf-8").slice(0, 12000);
    if (isPdf) {
      try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        try {
          const result = await parser.getText();
          const text = String(result?.text ?? "").replace(/\u0000/g, "").trim();
          if (text.length > 80) return text.slice(0, 15000);
        } finally {
          await parser.destroy().catch(() => null);
        }
      } catch (err) {
        // Scanned PDFs legitimately have no text layer; anything else (like a
        // broken import) must be visible in the system log, never silent.
        const { logSystem } = await import("../syslog");
        await logSystem("warning", "pdf_extract", `Could not extract text from ${doc.fileName}`, String(err));
      }
    }
  } catch {
    return "";
  }
  return "";
}

export async function runCaseAnalysis(caseId: string): Promise<void> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { documents: { where: { deletedAt: null } } },
  });
  if (!c) return;
  const previousStatus = c.status === "analyzing" ? "needs_info" : c.status;
  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  let caseVersionId: string | null = null;
  let caseVersion: Awaited<ReturnType<typeof ensureCaseVersion>> | null = null;
  try {
  let analysisPlanId: string | null = null;
  let parsedPlan: AnalysisPlan | null = null;
  try {
    caseVersion = await ensureCaseVersion(caseId, "analysis");
    caseVersionId = caseVersion.id;
    const analysisPlan = await createCaseAnalysisPlan(caseId, caseVersionId);
    analysisPlanId = analysisPlan?.id ?? null;
    parsedPlan = parseAnalysisPlan(analysisPlan?.planJson);
    if (analysisPlanId) await markAnalysisPlanRunning(analysisPlanId).catch(() => null);
  } catch (err) {
    const { logSystem } = await import("../syslog");
    await logSystem("warning", "case_versioning", "Could not create case version or analysis plan before analysis", String(err));
  }
  let decisions = parsedPlan
    ? analysisRunDecisions(parsedPlan)
    : analysisRunDecisions({
        case_complexity: "MODERATE",
        tasks_required: ["RECONSTRUCT_CASE", "RETRIEVE_AUTHORITY", "PRIMARY_REASONING", "PRESENT_APPROVED_STATE"],
        tasks_skipped: [],
        documents_to_process: [],
        deterministic_tools: ["EVIDENCE_RECONCILIATION", "READINESS_SPLIT", "ACTION_GRAPH"],
        authority_queries_needed: [],
        reasoning_level: "VERIFIED",
        review_required: true,
        human_review_required: false,
        questions_may_be_needed: false,
        blocking_conditions: [],
        stop_conditions: [],
      });
  const runtimeAdditions: { task: string; reason: string }[] = [];

  // Clear previous results for a clean re-run.
  await db.issue.deleteMany({ where: { caseId } });
  await db.pathStep.deleteMany({ where: { caseId } });

  // Layer 2 input: include actual document content where it can be read
  // (plain text + the text layer of digital PDFs, e.g. USCIS case records).
  const docParts: string[] = [];
  let rawDocText = "";
  const readableDocIds = new Set<string>();
  const docContents = await Promise.all(c.documents.map(async (d) => ({ doc: d, content: await getDocumentText(d) })));
  for (const { doc: d, content } of docContents) {
    if (content) {
      readableDocIds.add(d.id);
      if (!d.extractedJson) {
        await db.document.update({
          where: { id: d.id },
          data: { extractedJson: JSON.stringify({ raw_text: content.slice(0, 4000) }), status: "extracted" },
        });
      }
    }
    rawDocText += content ? `\n${content}` : "";
    docParts.push(
      `Document: ${d.fileName} (kind: ${d.docKind})${content ? `\nContent:\n${content}` : d.extractedJson ? `\nExtracted: ${d.extractedJson}` : "\n(scanned/photographed — see the attached file)"}`,
    );
  }
  const docText = docParts.join("\n\n");

  // Media for vision-capable providers: PDFs and images (scans/photos) are
  // attached so the models read the ACTUAL documents, not just filenames.
  const media: MediaAttachment[] = [];
  for (const d of c.documents) {
    if (media.length >= 6) break;
    const isImage = d.mimeType.startsWith("image/");
    const isPdf = d.mimeType === "application/pdf" || /\.pdf$/i.test(d.fileName);
    if (!isImage && !isPdf) continue;
    try {
      const buf = await readUpload(d.filePath);
      if (buf.length > 10 * 1024 * 1024) continue;
      media.push({
        mimeType: isPdf ? "application/pdf" : d.mimeType,
        dataBase64: buf.toString("base64"),
        name: d.fileName,
      });
    } catch { /* file missing — skip */ }
  }

  if (decisions.processDocuments && parsedPlan?.documents_to_process.length) {
    await processDocumentsEvidence(parsedPlan.documents_to_process).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "case_orchestrator", "Plan-driven document processing failed", String(err));
    });
  }
  if (decisions.retrieveAuthority) {
    await snapshotAuthorityForPlan(caseId, parsedPlan?.authority_queries_needed ?? [], {
      situation: c.situation,
      goal: c.goal,
    }).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "case_orchestrator", "Plan-driven authority retrieval failed", String(err));
    });
  }
  await rebuildCaseEvidenceState(caseId).catch(async (err) => {
    const { logSystem } = await import("../syslog");
    await logSystem("warning", "evidence_state", "Could not rebuild case evidence state before analysis", String(err));
  });

  async function stageRun(stageKey: string, vars: Record<string, string>, sequentialContext = false, stageMedia?: MediaAttachment[], roles?: string[]) {
    const run = await db.analysisRun.create({ data: { caseId, stageKey, status: "running" } });
    const outcome = await runStage(stageKey, vars, { runId: run.id, sequentialContext, media: stageMedia, roles });
    await db.analysisRun.update({
      where: { id: run.id },
      data: { status: "complete", finishedAt: new Date() },
    });
    await db.consensusResult.create({
      data: {
        runId: run.id,
        mergedJson: JSON.stringify(outcome.merged),
        conflictsJson: JSON.stringify(outcome.conflicts),
        verificationRequired: outcome.conflicts.length > 0,
      },
    });
    return outcome;
  }

  // Layer 2/3: summary, goal, and document analysis follow the case analysis plan.
  const skipAi = decisions.stop;
  const [summaryOut, goalOut, documentOut] = skipAi
    ? [EMPTY_STAGE, EMPTY_STAGE, null]
    : await Promise.all([
        decisions.reconstructCase ? stageRun(STAGE_KEYS.SUMMARY, { input: c.situation }, true) : Promise.resolve(EMPTY_STAGE),
        decisions.reconstructCase ? stageRun(STAGE_KEYS.GOAL, { input: c.goal }, true) : Promise.resolve(EMPTY_STAGE),
        decisions.processDocuments && c.documents.length
          ? stageRun(STAGE_KEYS.DOCUMENT, { input: docText }, false, media)
          : Promise.resolve(null),
      ]);

  // Documents read by a vision model count as examined evidence.
  if (documentOut?.usedAi && media.length > 0) {
    for (const d of c.documents) {
      if (readableDocIds.has(d.id) || d.extractedJson) continue;
      const wasSent = media.some((m) => m.name === d.fileName);
      if (wasSent) {
        await db.document.update({
          where: { id: d.id },
          data: { extractedJson: JSON.stringify({ vision_reviewed: true }), status: "extracted" },
        });
      }
    }
  }

  const usedAi = summaryOut.usedAi || goalOut.usedAi || (documentOut?.usedAi ?? false);
  const docInfos = c.documents.map((d) => ({
    docKind: d.docKind,
    readable:
      readableDocIds.has(d.id) ||
      d.mimeType.startsWith("text/") ||
      /\.(txt|csv|md|log)$/i.test(d.fileName) ||
      d.extractedJson.length > 0,
  }));
  const fallback = usedAi ? null : await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos, caseId);
  const facts = usedAi ? summaryOut.merged : fallback!.facts;
  const goalFacts = usedAi ? goalOut.merged : { user_goal: c.goal };
  let evidenceGate: Awaited<ReturnType<typeof getCaseEvidenceGateBrief>> | null = null;
  try {
    evidenceGate = await getCaseEvidenceGateBrief(caseId);
  } catch (err) {
    const { logSystem } = await import("../syslog");
    await logSystem("warning", "evidence_gate", "Could not load compiled evidence gate brief", String(err));
  }
  const evidenceGateJson = evidenceGate
    ? {
        status: evidenceGate.status,
        can_analyze: evidenceGate.canAnalyze,
        must_ground_claims: evidenceGate.mustGroundClaims,
        summary: evidenceGate.summary,
        current_position: evidenceGate.currentPosition,
        pending_actions: evidenceGate.pendingActions,
        unknowns: evidenceGate.unknowns,
        suppressed_questions: evidenceGate.suppressedQuestions,
        facts: evidenceGate.facts,
        events: evidenceGate.events,
      }
    : null;
  const primaryReasonerContext = decisions.reconstructCase
    ? await buildPrimaryReasonerContext(caseId).catch(async (err) => {
        const { logSystem } = await import("../syslog");
        await logSystem("warning", "primary_reasoner", "Could not build primary reasoner context", String(err));
        return null;
      })
    : null;

  // Layer 4: situation analysis grounded in the USCIS knowledge base.
  const knowledge = decisions.retrieveAuthority
    ? formatKnowledgeBlock(await retrieveKnowledgeRecords(`${c.situation} ${c.goal} ${docText}`, 5, caseId))
    : "";
  let situationMerged: Json = {};
  let situationConflicts: Conflict[] = [];
  if (usedAi && decisions.primaryReasoning) {
    const situationRoles = decisions.independentReview ? undefined : ["analyst"];
    const situationOut = await stageRun(STAGE_KEYS.SITUATION, {
      facts: JSON.stringify({ extracted_facts: facts, evidence_gate: evidenceGateJson }),
      documents: JSON.stringify({
        model_document_extraction: documentOut?.merged ?? null,
        compiled_evidence_gate: evidenceGateJson,
        evidence_gate_instructions: evidenceGate?.promptText ?? "",
        primary_reasoner_context: primaryReasonerContext,
      }),
      knowledge: knowledge || "(no matching reference material)",
      goal: JSON.stringify(goalFacts),
    }, false, undefined, situationRoles);
    situationMerged = situationOut.merged;
    situationConflicts = situationOut.conflicts;
    const situationIssues = Array.isArray((situationMerged as Json).issues)
      ? ((situationMerged as Json).issues as AnalysisIssueHint[])
      : [];
    const reviewAdd = parsedPlan ? runtimeReviewAddition(parsedPlan, situationIssues) : null;
    if (reviewAdd && !decisions.independentReview) {
      runtimeAdditions.push(reviewAdd);
      const reviewerOut = await stageRun(STAGE_KEYS.SITUATION, {
        facts: JSON.stringify({ extracted_facts: facts, evidence_gate: evidenceGateJson }),
        documents: JSON.stringify({
          model_document_extraction: documentOut?.merged ?? null,
          compiled_evidence_gate: evidenceGateJson,
          evidence_gate_instructions: evidenceGate?.promptText ?? "",
          primary_reasoner_context: primaryReasonerContext,
        }),
        knowledge: knowledge || "(no matching reference material)",
        goal: JSON.stringify(goalFacts),
      }, false, undefined, ["reviewer"]);
      if (reviewerOut.merged && Object.keys(reviewerOut.merged).length > 0) {
        situationMerged = reviewerOut.merged;
        situationConflicts = [...situationConflicts, ...reviewerOut.conflicts];
      }
      if (parsedPlan) decisions = analysisRunDecisions(parsedPlan, { issues: situationIssues });
    }
  }

  // Layer 5 presentation: a single AI converts internal analysis to structured
  // data; the UI renders it deterministically. Falls back to rule-based output.
  let presentation: Json | null = null;
  if (usedAi && decisions.presentApprovedState) {
    const presenterOut = await stageRun(STAGE_KEYS.PRESENTER, {
      input: JSON.stringify({
        facts,
        goal: goalFacts,
        documents: documentOut?.merged ?? null,
        evidence_gate: evidenceGateJson,
        primary_reasoner_context: primaryReasonerContext,
        evidence_gate_instructions: evidenceGate?.promptText ?? "",
        analysis: situationMerged,
        presentation_lock: true,
      }),
    });
    const p = presenterOut.stepOutputs.find((o) => o.data)?.data ?? null;
    presentation = p && Array.isArray((p as Json).issues) ? (p as Json) : null;
  }
  const issues: Json[] = presentation
    ? ((presentation.issues as Json[]) ?? [])
    : (fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos, caseId))).issues;

  // Persist issues.
  for (const [i, issue] of issues.entries()) {
    const oneOf = (v: unknown, allowed: string[], dflt: string) => (allowed.includes(String(v)) ? String(v) : dflt);
    // "What's still unclear" — structured list, with graceful fallback to the
    // legacy single what_we_dont_know sentence for AI outputs.
    const unclear = Array.isArray(issue.still_unclear)
      ? (issue.still_unclear as unknown[]).map(String).filter(Boolean)
      : issue.what_we_dont_know
        ? [String(issue.what_we_dont_know)]
        : [];
    await db.issue.create({
      data: {
        caseId,
        issueType: String(issue.issue_type ?? "other"),
        caseYear: typeof issue.case_year === "number" ? issue.case_year : null,
        title: String(issue.title ?? issue.issue_identified ?? `Issue ${i + 1}`).slice(0, 200),
        description: String(issue.what_we_know ?? ""),
        expectedCents: null,
        receivedCents: null,
        differenceCents: null,
        confidence: oneOf(issue.confidence, ["high", "medium", "low"], "medium"),
        priority: oneOf(issue.priority, ["urgent", "high", "medium", "low"], "medium"),
        state: oneOf(issue.state, ["resolved", "review", "action_needed", "urgent", "info_needed"], "review"),
        nextAction: normalizeActionKey(issue.next_action),
        uscisBasis: String(issue.uscis_basis ?? ""),
        // Evidence-based taxonomy: item kind + evidence status + strength.
        itemKind: oneOf(issue.item_kind, ["finding", "issue", "opportunity", "risk", "missing_info"], "issue"),
        evidenceStatus: oneOf(issue.evidence_status, ["confirmed", "likely", "possible", "needs_verification", "not_supported"], "needs_verification"),
        evidenceStrength: oneOf(issue.evidence_strength, ["strong", "moderate", "limited"], "limited"),
        conclusion: String(issue.our_conclusion ?? ""),
        unclearJson: JSON.stringify(unclear),
        explanationsJson: JSON.stringify(Array.isArray(issue.explanations) ? issue.explanations : []),
        altAction: String(issue.alternative_action ?? ""),
        // Per-item analysis outline (your situation → immigration rules → your evidence
        // → our conclusion → your next move), rendered under each item.
        evidenceJson: JSON.stringify(Array.isArray(issue.analysis_outline) ? issue.analysis_outline : []),
      },
    });
  }

  // Path forward steps (each carries an action key for evidence verification).
  const pathSteps: Json[] = presentation?.path_steps
    ? ((presentation.path_steps as Json[]) ?? [])
    : ((fallback ?? (await fallbackAnalyze(c.situation, c.goal, rawDocText, docInfos, caseId))).pathSteps as unknown as Json[]);
  for (const [i, step] of pathSteps.entries()) {
    await db.pathStep.create({
      data: {
        caseId,
        sortOrder: i,
        title: String(step.title ?? `Step ${i + 1}`).slice(0, 200),
        description: String(step.description ?? ""),
        actionKey: normalizeActionKey(step.action_key),
        status: i === 0 ? "current" : "pending",
      },
    });
  }

  // Deterministic readiness score (our formula, not an AI's opinion).
  const unknowns = Array.isArray(facts.unknowns) ? (facts.unknowns as unknown[]).length : 0;
  const allConflicts = [...summaryOut.conflicts, ...goalOut.conflicts, ...(documentOut?.conflicts ?? []), ...situationConflicts];
  const expectedDocs = await getNumberSetting("analysis.expected_documents", 3);
  const factKeys = Object.keys(facts).filter((k) => k !== "unknowns");
  const verifiedFacts = factKeys.filter((k) => {
    const v = facts[k];
    return v !== null && v !== "" && !(typeof v === "object" && v !== null && (v as Json).__conflict);
  }).length;
  const readiness = computeReadiness({
    documentsCount: c.documents.length,
    documentsExpected: expectedDocs,
    factsVerified: verifiedFacts,
    factsTotal: Math.max(factKeys.length, 1),
    uscisSourcesMatched: knowledge ? Math.min(3, knowledge.split("---").length) : 0,
    unresolvedConflicts: allConflicts.length,
    unknowns,
  });

  // Information conflicts: contradictions between the customer's narrative and
  // their documents (fallback engine) or between analysis engines (AI path).
  // Surfaced to the customer as INFORMATION CONFLICT cards — never guessed away.
  const displayConflicts = fallback
    ? fallback.conflicts
    : allConflicts.map((cf) => ({
        topic: cf.field.replace(/_/g, " "),
        description: `Our analysis sources disagree on "${cf.field.replace(/_/g, " ")}": ${cf.values.map((v) => String(v.value)).join(" vs. ")}.`,
        resolution: "Flagged for verification instead of guessing — your USCIS case record or the underlying document settles it.",
      }));

  // Consultant recommendation → notify admins.
  const needsConsultant =
    presentation?.consultant_recommended === true ||
    issues.some((i) => String(i.professional_review ?? "") === "required");
  await db.case.update({
    where: { id: caseId },
    data: {
      status: needsConsultant ? "consultant_recommended" : "analyzed",
      readinessScore: readiness,
      conflictsJson: JSON.stringify(displayConflicts),
    },
  });
  if (needsConsultant) {
    const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          kind: "consultant_needed",
          title: "A case needs a consultant",
          body: `Case "${c.title}" was flagged for professional review. Recommend a consultant to the user.`,
          link: `/admin/assignments?case=${caseId}`,
        },
      });
    }
    // Auto-assignment (admin-controlled; both parties still consent). A case
    // is only handed to a consultant when the analysis is grounded enough —
    // below the readiness threshold, admins are notified but no assignment is
    // proposed automatically.
    const minReadiness = await getNumberSetting("consultants.auto_assign_min_readiness", 60);
    if (readiness >= minReadiness) {
      const { autoAssignConsultant } = await import("../matching");
      await autoAssignConsultant(caseId).catch(async (err) => {
        const { logSystem } = await import("../syslog");
        await logSystem("error", "matching", "Auto-assignment failed for a flagged case", String(err));
        return false;
      });
    }
  }

  // Immediately verify path-step evidence (e.g. documents already uploaded at intake).
  await verifyCaseProgress(caseId);
  if (decisions.actionGraph) {
    await buildCaseActionGraph(caseId).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "action_graph", "Could not build case action graph", String(err));
    });
  }
  let presentationContract: ReturnType<typeof parsePresentationRecord> | null = null;
  if (decisions.presentApprovedState) {
    const presentationRow = await buildCasePresentation(caseId, caseVersionId).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "case_presentation", "Could not build case presentation contract", String(err));
      return null;
    });
    presentationContract = presentationRow ? parsePresentationRecord(presentationRow) : null;
  }
  const openUnknownCount = await db.caseUnknown.count({ where: { caseId, status: "open" } }).catch(() => 0);
  const questionAdd = parsedPlan ? runtimeQuestionAddition(parsedPlan, openUnknownCount) : null;
  if (questionAdd) {
    runtimeAdditions.push(questionAdd);
    if (parsedPlan) decisions = analysisRunDecisions(parsedPlan, { openUnknownCount });
  }
  if (decisions.questionPlanning) {
    await planCaseQuestions(caseId).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "question_planner", "Could not plan follow-up questions", String(err));
    });
  }
  let finishedPlan = parsedPlan;
  if (analysisPlanId && parsedPlan) {
    const execution = buildPlanExecution(parsedPlan, decisions, { runtimeAdditions });
    finishedPlan = withPlanExecution(parsedPlan, execution);
    const status = decisions.stop ? "skipped" : decisions.blocked ? "blocked" : "complete";
    await finishAnalysisPlan(analysisPlanId, finishedPlan, status).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "case_orchestrator", "Could not mark analysis plan complete", String(err));
    });
  }
  if (caseVersion) {
    const scores = await db.case.findUnique({
      where: { id: caseId },
      select: { evidenceAvailableScore: true, evidenceProcessedScore: true, actionReadinessScore: true },
    });
    const canonical = await db.canonicalCaseState.findUnique({ where: { caseId }, select: { evidenceSnapshotHash: true } });
    await finalizeCaseVersion(
      caseVersion.id,
      caseId,
      buildCanonicalApprovedState({
        version: caseVersion.version,
        reason: caseVersion.reason,
        pipelineConfigVersion: caseVersion.pipelineConfigVersion,
        evidenceSnapshotHash: canonical?.evidenceSnapshotHash ?? "",
        status: needsConsultant ? "consultant_recommended" : "analyzed",
        readinessScore: readiness,
        evidenceAvailableScore: scores?.evidenceAvailableScore,
        evidenceProcessedScore: scores?.evidenceProcessedScore,
        actionReadinessScore: scores?.actionReadinessScore,
        presentation: presentationContract,
        analysisPlan: finishedPlan,
      }),
    ).catch(async (err) => {
      const { logSystem } = await import("../syslog");
      await logSystem("warning", "case_versioning", "Could not finalize case version after analysis", String(err));
    });
  }
  } catch (err) {
    if (caseVersionId) await failCaseVersion(caseVersionId);
    await db.case.update({ where: { id: caseId }, data: { status: previousStatus } }).catch(() => null);
    throw err;
  }
}

async function loadCaseGrounding(caseId?: string | null) {
  if (!caseId) return { presentation: null as Awaited<ReturnType<typeof getCasePresentationBrief>>, evidenceBrief: null as Awaited<ReturnType<typeof getCaseEvidenceBrief>> | null, block: "", supportedText: "" };
  const presentation = await getCasePresentationBrief(caseId).catch(async (err) => {
    const { logSystem } = await import("../syslog");
    await logSystem("warning", "case_presentation", "Could not load approved presentation for grounding", String(err));
    return null;
  });
  const evidenceBrief = await getCaseEvidenceBrief(caseId).catch(async (err) => {
    const { logSystem } = await import("../syslog");
    await logSystem("warning", "evidence_brief", "Could not load case evidence brief", String(err));
    return null;
  });
  return {
    presentation,
    evidenceBrief,
    block: presentationGroundingBlock(presentation, evidenceBrief?.text ?? null),
    supportedText: mergeSupportedText(presentation?.supportedText, evidenceBrief?.supportedText),
  };
}

// ---------- Single-purpose AI helpers ----------

export async function runQaChat(history: { role: string; content: string }[], opts?: { caseId?: string | null }): Promise<string> {
  const steps = await getRunnableSteps(STAGE_KEYS.QA);
  const convo = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const inquiry = classifyImmigrationInquiry({ situation: question, goal: question });
  const knowledgeQuery = [
    history.map((m) => m.content).join(" "),
    inquiry.mode === "open_options" ? inquiry.themes.join(" ") : "",
    inquiry.mode === "open_options" ? authorityQueriesForInquiry(inquiry).join(" ") : "",
  ]
    .filter(Boolean)
    .join(" ");
  const knowledgeSources = await retrieveKnowledgeRecords(knowledgeQuery, 5, opts?.caseId);
  const knowledge = formatKnowledgeBlock(knowledgeSources);
  const grounding = await loadCaseGrounding(opts?.caseId);
  const fallbackAnswer = () =>
    buildQaFallbackAnswer({
      question,
      knowledge,
      sources: knowledgeSources,
      inquiry,
      hasLinkedCase: Boolean(opts?.caseId),
    });
  if (steps.length === 0) {
    return fallbackAnswer();
  }
  // Run every configured model in order. Later models receive earlier drafts so
  // the final answer benefits from all available providers instead of stopping
  // at the first successful response.
  const drafts: string[] = [];
  for (const step of steps) {
    try {
      const priorDrafts = drafts.length
        ? `\n\nPRIOR DRAFTS TO IMPROVE (do not mention them; correct any errors and produce one final answer):\n${drafts.map((draft, i) => `[Draft ${i + 1}]\n${draft}`).join("\n\n")}`
        : "";
      const evidenceContext = grounding.block
        ? `\n\n${grounding.block}\n\nGrounding rule: answer case-specific questions from the approved presentation, the evidence brief, the conversation, and USCIS reference material. Treat unsupported details as unknowns. Do not contradict the approved posture, next action, or deadlines.`
        : `\n\nAnswer as an options question: explain possible paths with conditions from matching official material. Never invent a receipt number, deadline, notice type, or filed-case posture. Do not require the user to upload a notice before you can help.`;
      const prompt = fill(step.promptTemplate, { input: `${convo}${priorDrafts}${evidenceContext}`, knowledge: knowledge || "(none)" });
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) drafts.push(result.text.trim());
    } catch (err) {
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed answering the immigration Q&A chat`, String(err));
    }
  }
  if (drafts.length > 0) return drafts[drafts.length - 1];
  return fallbackAnswer();
}

export async function explainNoticeContent(content: string, opts?: { caseId?: string | null }): Promise<Json | null> {
  const grounding = await loadCaseGrounding(opts?.caseId);
  const groundedInput = grounding.block
    ? `${content}\n\n${grounding.block}\n\nNotice grounding rule: explain this notice against the approved case presentation and compiled case record. Do not invent deadlines, receipt numbers, form types, outcomes, or requested evidence that are not in the notice text, approved presentation, or evidence brief. Do not replace the approved next action with a different plan.`
    : content;
  const outcome = await runStage(STAGE_KEYS.NOTICE, { input: groundedInput });
  const parsed = outcome.stepOutputs.find((o) => o.data)?.data ?? null;
  const fallbackSteps = [
    { title: "Keep the notice safe", description: "It's stored in your document vault." },
    { title: "Check the deadline", description: "USCIS notices usually show a response date, appointment date, or filing deadline. Add it to your deadlines." },
  ];
  if (parsed) {
    const nextSteps = Array.isArray(parsed.next_steps)
      ? parsed.next_steps.filter((step): step is { title: string; description: string } => Boolean(step) && typeof step === "object")
      : [];
    return {
      ...parsed,
      next_steps: withPresentationNoticeSteps(
        nextSteps.map((step) => ({ title: String((step as Json).title ?? ""), description: String((step as Json).description ?? "") })),
        grounding.presentation?.contract ?? null,
      ),
    };
  }
  // Deterministic fallback: identify USCIS notice/form/receipt references and match the knowledge base.
  const code = (content.toUpperCase().match(USCIS_REFERENCE_RE) ?? [])[0]?.replace(/\s|-/g, "") ?? "";
  const kb = code
    ? await db.knowledgeSource.findFirst({
        where: {
          isActive: true,
          OR: [
            { reference: { contains: code } },
            { title: { contains: code } },
            { tags: { contains: code.toLowerCase() } },
          ],
        },
      })
    : null;
  const posture = grounding.presentation?.contract.hero.current_posture;
  return {
    notice_type: code || null,
    plain_english_explanation: kb
      ? kb.content.slice(0, 1200)
      : posture
        ? `We stored your notice safely. It will be read against the approved case posture: ${posture}. Our reference library doesn't cover this USCIS notice type yet. A qualified immigration professional can review it, and it will be re-examined automatically on your next analysis.`
        : "We stored your notice safely. Our reference library doesn't cover this USCIS notice type yet. A qualified immigration professional can review it, and it will be re-examined automatically on your next analysis.",
    next_steps: withPresentationNoticeSteps(fallbackSteps, grounding.presentation?.contract ?? null),
    urgency: "medium",
    fallback: true,
  };
}

export async function generateLetterDraft(context: string, opts?: { caseId?: string | null }): Promise<string> {
  const steps = await getRunnableSteps(STAGE_KEYS.LETTER);
  const grounding = await loadCaseGrounding(opts?.caseId);
  const guardedContext = grounding.block
    ? `${context}\n\n${grounding.block}\n\nLetter grounding rule: write to the approved presentation. Do not include receipt numbers, form types, dates, deadlines, requested evidence, or case outcomes unless they appear in the approved presentation or compiled evidence brief. If needed, use placeholders for the user to verify.`
    : context;
  const guardBrief = grounding.supportedText ? { supportedText: grounding.supportedText } : null;
  // Try every configured model; log failures; fall back to the template letter.
  for (const step of steps) {
    try {
      const prompt = fill(step.promptTemplate, { input: guardedContext });
      const result = await callProvider(step.provider, [{ role: "user", content: prompt }]);
      if (result.text.trim()) return guardLetterDraftWithEvidence(result.text.trim(), guardBrief).text;
    } catch (err) {
      const { logSystem } = await import("../syslog");
      await logSystem("error", "ai_call", `${step.provider.name} failed generating a response letter draft`, String(err));
    }
  }
  {
    return guardLetterDraftWithEvidence(`[DATE]

U.S. Citizenship and Immigration Services
[USCIS ADDRESS FROM YOUR NOTICE]

Re: [FORM TYPE / NOTICE TYPE] — Receipt No. [RECEIPT NUMBER]
Applicant: [YOUR NAME]
A-Number: [A-NUMBER IF ANY]

To Whom It May Concern:

I am writing in response to the notice referenced above.

[Describe your situation here: ${context.slice(0, 300)}]

I respectfully request that you review the enclosed documentation and update my case record accordingly. Please contact me at the address or phone number below if you need any additional information.

Sincerely,

[YOUR NAME]
[YOUR ADDRESS]
[YOUR PHONE]

Enclosures: [LIST YOUR DOCUMENTS]`, guardBrief).text;
  }
}
