import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPTS, PROMPT_SUPERSEDES, PROMPT_VERSION } from "../src/lib/ai/prompts";
import {
  buildPresentationBrief,
  presentationGroundingBlock,
  withPresentationNoticeSteps,
} from "../src/lib/case-presentation-brief";
import { assemblePresentationContract, evidenceStrengthFromScores, parsePresentationRecord } from "../src/lib/case-presentation-contract";
import { caseListActionLine, caseListEvidenceLine, caseListSummary, caseListSummaryFromView, caseListVersionLine } from "../src/lib/case-presentation-list";
import { presentationReportSections } from "../src/lib/case-report-presentation";
import { presentationActionStatus, presentationEvidenceGateLabel, presentationStepCta } from "../src/lib/case-presentation-ui";
import {
  ANALYSIS_TASKS,
  analysisPlanSummary,
  analysisRunDecisions,
  buildAnalysisPlan,
  buildPlanExecution,
  issuesNeedIndependentReview,
  runtimeQuestionAddition,
  runtimeReviewAddition,
} from "../src/lib/case-analysis-plan";
import {
  buildCanonicalApprovedState,
  buildApprovedCaseView,
  canonicalStateSummary,
  parseCanonicalApprovedState,
  selectApprovedPresentation,
  versionReasonLabel,
} from "../src/lib/canonical-case-state";
import { buildEvidenceGateBriefFromReconciled, compileImmigrationEvidence, computeEvidenceReadinessSplit, evaluateEvidenceAction, extractUniversalDocumentIntelligence, guardLetterDraftWithEvidence, reconcileEvidenceStates } from "../src/lib/evidence";
import {
  applyInquiryToEvidenceState,
  buildOpenOptionsAnalysis,
  buildQaFallbackAnswer,
  classifyImmigrationInquiry,
  INQUIRY_MODES,
  OPEN_OPTIONS_POSTURE,
} from "../src/lib/immigration-inquiry";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), "scripts", "fixtures", "evidence", name), "utf8");
}

const receipt = compileImmigrationEvidence({
  id: "fixture-i797",
  fileName: "i797-receipt.txt",
  text: fixture("i797-receipt.txt"),
});

const rfe = compileImmigrationEvidence({
  id: "fixture-rfe",
  fileName: "rfe-notice.txt",
  text: fixture("rfe-notice.txt"),
});
const noid = compileImmigrationEvidence({
  id: "fixture-noid",
  fileName: "noid-notice.txt",
  text: fixture("noid-notice.txt"),
});
const biometrics = compileImmigrationEvidence({
  id: "fixture-biometrics",
  fileName: "biometrics-notice.txt",
  text: fixture("biometrics-notice.txt"),
});
const approval = compileImmigrationEvidence({
  id: "fixture-approval",
  fileName: "approval-notice.txt",
  text: fixture("approval-notice.txt"),
});
const universalRfe = extractUniversalDocumentIntelligence({
  fileName: "rfe-notice.txt",
  documentType: "rfe",
  text: fixture("rfe-notice.txt"),
});

const receiptFacts = receipt.facts.map((fact) => `${fact.key}:${fact.value}`);
const rfeFacts = rfe.facts.map((fact) => `${fact.key}:${fact.value}`);

assert(receipt.documentType === "i797_notice", `expected I-797 classification, got ${receipt.documentType}`);
assert(receiptFacts.includes("receipt_number:MSC2390123456"), "receipt fixture should extract receipt number");
assert(receiptFacts.includes("form_type:I-485"), "receipt fixture should extract I-485 form type");
assert(receipt.suppressedQuestions.some((item) => item.questionKey === "receipt_number"), "receipt number question should be suppressed");
assert(receipt.audit.status === "pass", `receipt audit should pass, got ${receipt.audit.status}`);

assert(rfe.documentType === "rfe", `expected RFE classification, got ${rfe.documentType}`);
assert(rfeFacts.includes("notice_type:RFE"), "RFE fixture should extract notice type");
assert(rfe.facts.some((fact) => fact.key === "response_deadline" && /July 31, 2026/.test(fact.value)), "RFE fixture should extract response deadline");
assert(rfe.facts.some((fact) => fact.key === "requested_evidence"), "RFE fixture should extract requested evidence");
assert(rfe.relationships.some((rel) => rel.relationType === "deadline_for_notice"), "RFE deadline should relate to the notice");
assert(noid.documentType === "noid", `expected NOID classification, got ${noid.documentType}`);
assert(noid.facts.some((fact) => fact.key === "notice_type" && fact.value === "NOID"), "NOID fixture should extract notice type");
assert(noid.facts.some((fact) => fact.key === "response_deadline" && /July 10, 2026/.test(fact.value)), "NOID fixture should extract response deadline");
assert(biometrics.documentType === "biometrics_notice", `expected biometrics classification, got ${biometrics.documentType}`);
assert(biometrics.facts.some((fact) => fact.key === "appointment_date" && /April 21, 2026/.test(fact.value)), "biometrics fixture should extract appointment date");
assert(evaluateEvidenceAction("PREPARE_APPOINTMENT", buildEvidenceGateBriefFromReconciled(reconcileEvidenceStates([biometrics])))?.satisfied === true, "biometrics appointment should satisfy appointment preparation action");
assert(approval.documentType === "approval_notice", `expected approval classification, got ${approval.documentType}`);
assert(approval.facts.some((fact) => fact.key === "notice_type" && fact.value === "APPROVAL"), "approval fixture should extract approval notice type");
assert(universalRfe.pages.length === 1 && universalRfe.pages[0].text.includes("Request for Evidence"), "universal extraction should preserve page text");
assert(universalRfe.facts.some((fact) => fact.original_label === "Receipt Number" && fact.source_anchor.field === "Receipt Number"), "universal extraction should preserve labels and source anchors");
assert(universalRfe.instructions_and_conditions.some((item) => /Submit evidence/i.test(item)), "universal extraction should preserve instructions");
assert(universalRfe.unclassified_content.length > 0, "universal extraction should preserve unclassified content");

const combined = JSON.stringify([receipt, rfe]).toLowerCase();
const forbiddenTaxTerms = [/\birs\b/, /\btax transcript\b/, /\bform 9465\b/, /\brefund\b/, /\bbalance due\b/];
for (const forbidden of forbiddenTaxTerms) {
  assert(!forbidden.test(combined), `evidence output leaked forbidden tax term: ${forbidden}`);
}

const reconciled = reconcileEvidenceStates([receipt, rfe]);
assert(reconciled.audit.status === "pass", `reconciled audit should pass, got ${reconciled.audit.status}`);
assert(reconciled.crossDocumentRelationships.some((rel) => rel.relationType === "same_receipt"), "I-797 and RFE should link by shared receipt number");
assert(reconciled.suppressedQuestions.some((item) => item.questionKey === "receipt_number"), "reconciled receipt question should be suppressed");
assert(reconciled.reconstruction.currentPosition === "RFE notice needs review", `unexpected current position: ${reconciled.reconstruction.currentPosition}`);
assert(reconciled.reconstruction.pendingActions.some((action) => /RFE response by July 31, 2026/.test(action)), "RFE deadline should become a pending action");
const gate = buildEvidenceGateBriefFromReconciled(reconciled);
assert(gate.status === "pass", `evidence gate should pass, got ${gate.status}`);
assert(gate.mustGroundClaims === true, "evidence gate should require grounded claims");
assert(gate.promptText.includes("GROUNDING RULE"), "evidence gate prompt should include grounding rule");
assert(gate.promptText.includes("RFE notice needs review"), "evidence gate prompt should include current position");
assert(evaluateEvidenceAction("GET_CASE_RECORD", gate)?.satisfied === true, "receipt + form evidence should satisfy case-record action");
assert(evaluateEvidenceAction("UPLOAD_NOTICE", gate)?.satisfied === true, "notice evidence should satisfy upload-notice action");
assert(evaluateEvidenceAction("ADD_DEADLINE", gate)?.satisfied === true, "deadline evidence should satisfy deadline action");
assert(evaluateEvidenceAction("DRAFT_LETTER", gate)?.satisfied === false, "letter action should still require a drafted letter");
for (const promptKey of ["analyst", "reviewer", "presenter"]) {
  const prompt = DEFAULT_PROMPTS[promptKey];
  assert(prompt.includes("evidence_gate"), `${promptKey} prompt should mention evidence_gate`);
  assert(prompt.includes("suppressed"), `${promptKey} prompt should mention suppressed questions`);
  assert((PROMPT_SUPERSEDES[promptKey] ?? []).length > 0, `${promptKey} prompt should declare superseded hashes`);
}
assert(DEFAULT_PROMPTS.presenter.includes("Presenter lockdown"), "presenter prompt should declare presenter lockdown");
assert((PROMPT_SUPERSEDES.presenter ?? []).includes("1293dbaff7ad239de591aeed73d91dcfd84e3c2c28be89582ecd573c9c029023"), "presenter prompt should supersede the pre-lockdown hash");
assert(DEFAULT_PROMPTS.analyst.includes("primary_reasoner_context"), "analyst prompt should mention primary_reasoner_context");
assert(DEFAULT_PROMPTS.reviewer.includes("primary_reasoner_context"), "reviewer prompt should mention primary_reasoner_context");
assert(DEFAULT_PROMPTS.notice_explainer.includes("COMPILED CASE EVIDENCE BRIEF"), "notice explainer prompt should mention compiled evidence brief");
assert(DEFAULT_PROMPTS.notice_explainer.includes("APPROVED CASE PRESENTATION"), "notice explainer prompt should mention approved case presentation");
assert((PROMPT_SUPERSEDES.notice_explainer ?? []).length > 0, "notice explainer prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.assistant.includes("APPROVED CASE PRESENTATION"), "assistant prompt should mention approved case presentation");
assert((PROMPT_SUPERSEDES.assistant ?? []).length > 0, "assistant prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.letter_writer.includes("APPROVED CASE PRESENTATION"), "letter writer prompt should mention approved case presentation");
assert((PROMPT_SUPERSEDES.letter_writer ?? []).length > 0, "letter writer prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.guide.includes("current evidence position"), "guide prompt should mention current evidence position");
assert(DEFAULT_PROMPTS.guide.includes("approved posture"), "guide prompt should mention approved posture");
assert((PROMPT_SUPERSEDES.guide ?? []).length > 0, "guide prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.closing.includes("evidence_brief"), "closing prompt should mention evidence_brief");
assert(DEFAULT_PROMPTS.closing.includes("approved_presentation"), "closing prompt should mention approved presentation");
assert((PROMPT_SUPERSEDES.closing ?? []).length > 0, "closing prompt should declare superseded hashes");
assert(PROMPT_VERSION.includes("v32"), "prompt version should identify v32 evidence prompts");
assert(DEFAULT_PROMPTS.analyst.includes("options inquiry"), "analyst prompt should handle people with no USCIS case file");
assert(DEFAULT_PROMPTS.assistant.includes("no USCIS file"), "assistant prompt should answer questions with no USCIS file");
assert((PROMPT_SUPERSEDES.analyst ?? []).includes("ed754670a3175d8e9db512d2e839a29391c74448889024c80981c2d0db7ec9e7"), "analyst prompt should supersede the pre-open-options hash");
const readiness = computeEvidenceReadinessSplit({
  documentsCount: 2,
  documentsExpected: 3,
  extractedDocumentsCount: 2,
  needsReviewDocumentsCount: 0,
  reconciled,
});
assert(readiness.evidenceAvailableScore === 67, `expected evidence available 67, got ${readiness.evidenceAvailableScore}`);
assert(readiness.evidenceProcessedScore === 100, `expected evidence processed 100, got ${readiness.evidenceProcessedScore}`);
assert(readiness.actionReadinessScore === 100, `expected action readiness 100, got ${readiness.actionReadinessScore}`);
const letterBrief = {
  status: gate.status,
  currentPosition: gate.currentPosition,
  summary: gate.summary,
  facts: gate.facts,
  events: gate.events,
  unknowns: gate.unknowns,
  pendingActions: gate.pendingActions,
  text: gate.promptText,
  supportedText: [gate.currentPosition, gate.summary, ...gate.pendingActions, ...gate.facts.flatMap((fact) => [fact.key, fact.value, fact.source]), ...gate.events.flatMap((event) => [event.eventType, event.title, event.dateText])].join("\n").toUpperCase(),
};
const guardedLetter = guardLetterDraftWithEvidence(
  "USCIS should continue processing Form I-485 for receipt MSC2390123456 by July 31, 2026. Please also update WAC0000000000 by August 5, 2026.",
  letterBrief,
);
assert(guardedLetter.changed === true, "letter guard should replace unsupported values");
assert(guardedLetter.text.includes("MSC2390123456"), "letter guard should keep supported receipt number");
assert(guardedLetter.text.includes("I-485"), "letter guard should keep supported form type");
assert(!guardedLetter.text.includes("WAC0000000000"), "letter guard should remove unsupported receipt number");
assert(!guardedLetter.text.includes("August 5, 2026"), "letter guard should remove unsupported date");

assert(evidenceStrengthFromScores(100) === "Strong", "high action readiness should map to Strong evidence");
assert(evidenceStrengthFromScores(40) === "Moderate", "mid action readiness should map to Moderate evidence");
assert(evidenceStrengthFromScores(10) === "Limited", "low action readiness should map to Limited evidence");
const presentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 100,
  reconstruction: {
    currentPosition: reconciled.reconstruction.currentPosition,
    summary: reconciled.reconstruction.summary,
    timeline: reconciled.reconstruction.timeline,
    pendingActions: reconciled.reconstruction.pendingActions,
  },
  issues: [{
    id: "issue-rfe",
    title: "Respond to the RFE",
    itemKind: "issue",
    state: "action_needed",
    evidenceStatus: "confirmed",
    evidenceStrength: "strong",
    conclusion: "The RFE deadline is on the notice.",
    nextAction: "UPLOAD_NOTICE",
    issueType: "uscis_notice_response",
    altAction: "",
  }, {
    id: "issue-review",
    title: "Licensed professional review",
    itemKind: "risk",
    state: "review",
    evidenceStatus: "possible",
    evidenceStrength: "limited",
    conclusion: "A licensed professional should review the response.",
    nextAction: "REVIEW_ANALYSIS",
    issueType: "professional_review",
    altAction: "",
  }],
  deadlines: [{ id: "dl-rfe", title: "RFE response", dueDate: "2026-07-31T00:00:00.000Z", source: "notice" }],
  actionNodes: [
    { id: "act-blocked", title: "Gather older records", actionKey: "GET_CASE_RECORD", status: "COMPLETED", priority: 1 },
    { id: "act-ready", title: "Respond to the RFE", actionKey: "UPLOAD_NOTICE", status: "READY", priority: 2 },
  ],
  documents: [{ id: "doc-rfe", fileName: "rfe-notice.txt", documentType: "rfe", processingStatus: "extracted" }],
  unknowns: [{ question: "What evidence will be submitted for the RFE?" }],
  evidenceGateStatus: gate.status,
  conflicts: [],
});
assert(presentation.hero.current_posture === "RFE notice needs review", "presentation hero should use reconstructed posture");
assert(presentation.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "presentation hero should pick the ready action");
assert(presentation.hero.nearest_deadline?.title === "RFE response", "presentation hero should include the nearest deadline");
assert(presentation.hero.professional_review_recommended === true, "presentation hero should flag professional review");
assert(presentation.what_this_means.unresolved_count === 2, "presentation should count unresolved findings");
assert(presentation.findings.length === 2, "presentation should include findings");
assert(presentation.actions.some((action) => action.status === "READY"), "presentation should include ready actions");
assert(presentation.evidence[0].document_type === "rfe", "presentation should include extracted evidence");
assert(presentation.professional_review?.issue_id === "issue-review", "presentation should attach the professional review finding");
const parsedPresentation = parsePresentationRecord({
  heroJson: JSON.stringify(presentation.hero),
  whatThisMeansJson: JSON.stringify(presentation.what_this_means),
  timelineJson: JSON.stringify(presentation.timeline),
  findingsJson: JSON.stringify(presentation.findings),
  deadlinesJson: JSON.stringify(presentation.deadlines),
  actionsJson: JSON.stringify(presentation.actions),
  evidenceJson: JSON.stringify(presentation.evidence),
  professionalReviewJson: JSON.stringify(presentation.professional_review),
});
assert(parsedPresentation.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "stored presentation should round-trip the next best action");
assert(parsedPresentation.hero.professional_review_recommended === true, "stored presentation should round-trip professional review");
assert(presentationActionStatus("READY").label === "Ready now", "ready actions should use a customer-facing Ready now label");
assert(presentationActionStatus("COMPLETED").tone === "done", "completed actions should use the done tone");
assert(presentationEvidenceGateLabel("pass") === "Records checked", "pass evidence gate should use a customer-facing records label");
assert(presentationStepCta("UPLOAD_NOTICE", "case-1")?.href === "/app/documents", "notice upload should link to documents");
assert(presentationStepCta("DRAFT_LETTER", "case-1")?.href === "/app/letters/new?case=case-1", "letter action should keep the case id");

const listFromContract = caseListSummary({
  status: "analyzed",
  reconstructionPosition: "STALE reconstruction posture",
  presentation,
});
assert(listFromContract.posture === "RFE notice needs review", "case list should prefer the approved presentation posture");
assert(listFromContract.nextActionTitle === "Respond to the RFE", "case list should show the approved next action");
assert(listFromContract.deadlineTitle === "RFE response", "case list should show the approved nearest deadline");
assert(listFromContract.evidenceStrength === "Strong", "case list should show presentation evidence strength");
assert(caseListActionLine(listFromContract).includes("Next: Respond to the RFE"), "case list action line should include the next action");
assert(caseListEvidenceLine(listFromContract).includes("Evidence strong"), "case list evidence line should include evidence strength");
const listWithoutContract = caseListSummary({
  status: "draft",
  actionReadinessScore: 10,
  reconstructionPosition: "Waiting for records",
});
assert(listWithoutContract.posture === "Waiting for records", "case list without a contract should fall back to reconstruction");
assert(listWithoutContract.nextActionTitle === null, "case list without a contract should not invent a next action");

const reportHtml = presentationReportSections(presentation);
assert(reportHtml.includes("<h2>Where you stand</h2>"), "case report should include Where you stand");
assert(reportHtml.includes("<h2>What this means</h2>"), "case report should include What this means");
assert(reportHtml.includes("<h2>Timeline</h2>"), "case report should include Timeline");
assert(reportHtml.includes("<h2>Findings (2)</h2>"), "case report should include Findings");
assert(reportHtml.includes("<h2>Your next steps</h2>"), "case report should include Your next steps");
assert(reportHtml.includes("RFE notice needs review"), "case report should use the approved posture");
assert(reportHtml.includes("Respond to the RFE"), "case report should use the approved next action");
assert(!reportHtml.includes("STALE reconstruction posture"), "case report must not invent a stale reconstruction posture");
const xssReport = presentationReportSections({
  ...presentation,
  hero: { ...presentation.hero, current_posture: "<script>alert(1)</script>" },
});
assert(xssReport.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "case report should escape HTML in presentation fields");
assert(!xssReport.includes("<script>alert(1)</script>"), "case report must not emit raw HTML from presentation fields");

const brief = buildPresentationBrief(presentation);
assert(brief.text.includes("RFE notice needs review"), "presentation brief must use the approved posture");
assert(brief.text.includes("Respond to the RFE"), "presentation brief must use the approved next action");
assert(!brief.text.includes("STALE reconstruction posture"), "presentation brief must not use reconstruction posture");
const grounded = presentationGroundingBlock(brief, "- passport is on file");
assert(grounded.includes("APPROVED CASE PRESENTATION"), "letters, notices, and Q&A must receive the approved presentation block");
assert(grounded.includes("COMPILED CASE EVIDENCE BRIEF"), "presentation grounding must still include compiled evidence");
assert(grounded.includes("RFE notice needs review"), "presentation grounding must include the approved posture");
const noticeSteps = withPresentationNoticeSteps(
  [{ title: "Keep copies of everything", description: "Store the notice." }],
  presentation,
);
assert(noticeSteps[0]?.title === "Respond to the RFE", "notice explanations must surface the approved next action first");
assert(noticeSteps[1]?.title === "Keep copies of everything", "notice explanations must keep the notice-specific steps");
const dedupedSteps = withPresentationNoticeSteps(
  [{ title: "Respond to the RFE", description: "Already listed." }],
  presentation,
);
assert(dedupedSteps.length === 1, "notice explanations must not duplicate the approved next action");

const lowPlan = buildAnalysisPlan({
  caseStatus: "analyzed",
  documentCount: 1,
  documents: [{ id: "doc-1", processingStatus: "extracted" }],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "pass",
  evidenceFactKeys: ["form_type"],
});
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.PROCESS_DOCUMENTS), "extracted documents should skip PROCESS_DOCUMENTS");
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "low-risk cases should skip independent review");
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.QUESTION_PLANNING), "cases without unknowns should skip question planning");
assert(lowPlan.tasks_required.includes(ANALYSIS_TASKS.PRIMARY_REASONING), "analysis plan should still run primary reasoning");
assert(lowPlan.deterministic_tools.includes("ACTION_GRAPH"), "analysis plan should include the action graph tool");
const lowDecisions = analysisRunDecisions(lowPlan);
assert(lowDecisions.processDocuments === false, "pipeline must not process already-extracted documents");
assert(lowDecisions.independentReview === false, "pipeline must not run independent review when the plan skipped it");
assert(lowDecisions.primaryReasoning === true, "pipeline must run primary reasoning when the plan requires it");

const blockedPlan = buildAnalysisPlan({
  caseStatus: "analyzed",
  documentCount: 1,
  documents: [{ id: "doc-1", processingStatus: "extracted" }],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "blocked",
  evidenceFactKeys: [],
});
assert(blockedPlan.blocking_conditions.length > 0, "blocked evidence should record a blocking condition");
assert(analysisRunDecisions(blockedPlan).primaryReasoning === false, "blocked evidence must not invent a new analysis");
assert(analysisRunDecisions(blockedPlan).reconstructCase === true, "blocked evidence should still reconstruct the case");

const closedPlan = buildAnalysisPlan({
  caseStatus: "closed",
  documentCount: 0,
  documents: [],
  issues: [],
  unknowns: [],
  evidenceFactKeys: [],
});
assert(closedPlan.stop_conditions.length > 0, "closed cases should record a stop condition");
assert(analysisRunDecisions(closedPlan).stop === true, "closed cases must stop the analysis pipeline");
assert(analysisRunDecisions(closedPlan).presentApprovedState === false, "closed cases must not run presentation AI");

const optionsPlan = buildAnalysisPlan({
  caseStatus: "analyzing",
  documentCount: 0,
  documents: [],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "blocked",
  evidenceFactKeys: [],
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
});
assert(optionsPlan.blocking_conditions.length === 0, "open-options inquiries must not treat missing USCIS identifiers as a blocking condition");
assert(analysisRunDecisions(optionsPlan).primaryReasoning === true, "open-options inquiries must still run primary reasoning");
assert(analysisRunDecisions(optionsPlan).processDocuments === false, "open-options inquiries with no documents must skip document processing");
assert(optionsPlan.tasks_required.includes(ANALYSIS_TASKS.QUESTION_PLANNING), "open-options inquiries should plan follow-up questions");
assert(optionsPlan.authority_queries_needed.includes("I-130"), "open-options family inquiries should look up family petition rules");

assert(issuesNeedIndependentReview([{ professional_review: "required" }]) === true, "required professional review should trigger independent review");
const reviewAdd = runtimeReviewAddition(lowPlan, [{ issue_type: "professional_review" }]);
assert(reviewAdd?.task === ANALYSIS_TASKS.INDEPENDENT_REVIEW, "pipeline should add independent review when a finding requires it");
const questionAdd = runtimeQuestionAddition(lowPlan, 2);
assert(questionAdd?.task === ANALYSIS_TASKS.QUESTION_PLANNING, "pipeline should add question planning when unknowns remain");
const runtimeDecisions = analysisRunDecisions(lowPlan, { issues: [{ professional_review: "required" }], openUnknownCount: 2 });
assert(runtimeDecisions.independentReview === true, "runtime professional-review findings must enable independent review");
assert(runtimeDecisions.questionPlanning === true, "runtime unknowns must enable question planning");
const execution = buildPlanExecution(lowPlan, runtimeDecisions, { runtimeAdditions: [reviewAdd!, questionAdd!] });
assert(execution.tasks_executed.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "execution record must include runtime independent review");
assert(!execution.tasks_skipped.some((item) => item.task === ANALYSIS_TASKS.INDEPENDENT_REVIEW), "runtime independent review must not stay in the skipped list");
const summary = analysisPlanSummary({ ...lowPlan, execution });
assert(summary.executedLabels.includes("Second independent review"), "analysis plan summary should use customer-facing task labels");
assert(summary.complexityLabel === "Straightforward", "low-complexity plans should use a customer-facing complexity label");

const approvedState = buildCanonicalApprovedState({
  version: 2,
  reason: "analysis",
  pipelineConfigVersion: "v4.1-a11",
  evidenceSnapshotHash: "snapshot-hash-rfe",
  status: "analyzed",
  readinessScore: 72,
  evidenceAvailableScore: 80,
  evidenceProcessedScore: 70,
  actionReadinessScore: 65,
  presentation,
  analysisPlan: { ...lowPlan, execution },
});
assert(approvedState.presentation?.hero.current_posture === "RFE notice needs review", "canonical approved state must store the approved posture");
assert(!/STALE reconstruction/i.test(approvedState.presentation?.hero.current_posture ?? ""), "canonical approved state must not store a stale reconstruction posture");
assert(approvedState.analysis_plan?.execution?.tasks_executed.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "canonical approved state must keep the executed analysis plan");
assert(approvedState.analysis_plan?.execution?.tasks_skipped.some((item) => item.task === ANALYSIS_TASKS.PROCESS_DOCUMENTS), "canonical approved state must keep skipped plan tasks");
const roundTrip = parseCanonicalApprovedState(JSON.stringify(approvedState));
assert(roundTrip?.version === 2, "canonical approved state should round-trip the version number");
assert(roundTrip?.presentation?.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "canonical approved state should round-trip the presentation");
assert(roundTrip?.analysis_plan?.execution?.blocked === false, "canonical approved state should round-trip plan execution");
assert(canonicalStateSummary(approvedState).versionLabel === "Case record version 2", "canonical summary should include the version label");
assert(canonicalStateSummary(approvedState).posture === "RFE notice needs review", "canonical summary should use the approved posture");
assert(canonicalStateSummary(approvedState).nextAction === presentation.hero.next_best_action?.title, "canonical summary should include the next action");
assert(versionReasonLabel("analysis") === "Full case review", "analysis versions should use a customer-facing reason label");
assert(versionReasonLabel("document") === "New documents on file", "document versions should use a customer-facing reason label");
assert(versionReasonLabel("clarify") === "Answers added to the case", "clarify versions should use a customer-facing reason label");
assert(versionReasonLabel("reprocess") === "Evidence reprocessed", "reprocess versions should use a customer-facing reason label");
assert(parseCanonicalApprovedState(JSON.stringify({ status: "analyzed", readinessScore: 10, issues: [], path_steps: [] })) === null, "legacy slim approved state is not a canonical versioned state");

const staleStored = { ...presentation, hero: { ...presentation.hero, current_posture: "STALE stored presentation" } };
const staleLive = { ...presentation, hero: { ...presentation.hero, current_posture: "STALE reconstruction posture" } };
const selected = selectApprovedPresentation({ canonical: approvedState, stored: staleStored, live: staleLive });
assert(selected?.source === "canonical", "approved presentation selector must prefer canonical state");
assert(selected?.presentation.hero.current_posture === "RFE notice needs review", "canonical approved presentation must beat a stale stored presentation");
assert(selectApprovedPresentation({ stored: staleStored, live: staleLive })?.source === "stored", "stored presentation is used when canonical is missing");
assert(selectApprovedPresentation({ live: staleLive })?.source === "live", "live assembly is used only when no approved presentation exists");
const approvedView = buildApprovedCaseView({ canonical: approvedState, stored: staleStored, live: staleLive });
assert(approvedView.source === "canonical", "approved case view must record canonical as the source");
assert(approvedView.version === 2, "approved case view must keep the canonical version number");
const listFromCanonical = caseListSummaryFromView(
  { status: "analyzed", reconstructionPosition: "STALE reconstruction posture" },
  approvedView,
);
assert(listFromCanonical.posture === "RFE notice needs review", "case lists must use the canonical approved posture");
assert(listFromCanonical.version === 2, "case lists must show the approved case record version");
assert(caseListVersionLine(listFromCanonical) === "Version 2 · Full case review", "case lists must use a customer-facing version line");
assert(!/STALE reconstruction/i.test(listFromCanonical.posture), "case lists must not show a stale reconstruction posture when canonical state exists");
assert(!/STALE stored/i.test(listFromCanonical.posture), "case lists must not show a stale stored presentation when canonical state exists");

const rfeInquiry = classifyImmigrationInquiry({
  situation: "I got an RFE from USCIS and the deadline is coming up.",
  goal: "Prepare an RFE response",
});
assert(rfeInquiry.mode === INQUIRY_MODES.EXISTING_CASE, "RFE language should classify as an existing USCIS case");
const marriageInquiry = classifyImmigrationInquiry({
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
  documentCount: 0,
});
assert(marriageInquiry.mode === INQUIRY_MODES.OPEN_OPTIONS, "a marriage goal with no filing should classify as open options");
assert(marriageInquiry.themes.includes("family"), "a marriage green-card question should detect the family theme");
const studentInquiry = classifyImmigrationInquiry({
  situation: "I am on F-1 graduating next month. What can I do?",
  goal: "Work or stay after graduation",
});
assert(studentInquiry.mode === INQUIRY_MODES.OPEN_OPTIONS, "an F-1 graduation question with no case file should classify as open options");
assert(studentInquiry.themes.includes("student"), "an F-1 graduation question should detect the student theme");

const marriageOptions = buildOpenOptionsAnalysis({
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
});
assert(marriageOptions.reconstruction.currentPosition === OPEN_OPTIONS_POSTURE, "open-options reconstruction should use the exploring-options posture");
assert(marriageOptions.issues.some((issue) => /family green card/i.test(issue.title) && issue.item_kind === "opportunity"), "marriage options should emit a family pathway opportunity");
assert(marriageOptions.pathSteps[0]?.action_key === "ADD_CASE_DETAILS", "open-options next steps should start with clarifying facts, not uploading a notice");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "UPLOAD_NOTICE" || step.action_key === "GET_CASE_RECORD"), "open-options next steps must not require a USCIS case record");
assert(!marriageOptions.issues.some((issue) => /more immigration details are needed/i.test(issue.title)), "open-options analysis must not dead-end on missing case details");

const studentOptions = buildOpenOptionsAnalysis({
  situation: "I am on F-1 graduating next month. What can I do?",
  goal: "See my work and stay options",
});
assert(studentOptions.issues.some((issue) => /student|graduation|opt/i.test(`${issue.title} ${issue.our_conclusion}`)), "F-1 options should describe student or after-graduation paths");

const emptyReconcile = reconcileEvidenceStates([{
  documentType: "other",
  facts: [],
  events: [],
  relationships: [],
  unknowns: [],
  suppressedQuestions: [],
  audit: { status: "needs_more_evidence", summary: "", blockingUnknowns: [], warnings: [] },
  reconstruction: { summary: "", currentPosition: "", timeline: [], pendingActions: [], confidence: "needs_verification" },
}]);
assert(emptyReconcile.reconstruction.currentPosition === "Case posture needs verification", "empty evidence should still reconstruct as unverified before inquiry overlay");
const overlaid = applyInquiryToEvidenceState(emptyReconcile, marriageInquiry, "Show me what options I have");
assert(overlaid.reconstruction.currentPosition === OPEN_OPTIONS_POSTURE, "inquiry overlay should replace unverified case posture for open options");
assert(!overlaid.unknowns.some((item) => item.key === "receipt_number"), "open-options overlay must not ask for a receipt number the person does not have");
assert(overlaid.audit.status !== "blocked", "open-options overlay must not leave the evidence audit blocked");

const optionsPresentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 20,
  reconstruction: {
    currentPosition: overlaid.reconstruction.currentPosition,
    summary: overlaid.reconstruction.summary,
    timeline: [],
    pendingActions: overlaid.reconstruction.pendingActions,
  },
  issues: marriageOptions.issues.map((issue, index) => ({
    id: `opt-${index}`,
    title: issue.title,
    itemKind: issue.item_kind,
    state: issue.state,
    evidenceStatus: issue.evidence_status,
    evidenceStrength: issue.evidence_strength,
    conclusion: issue.our_conclusion,
    nextAction: issue.next_action,
    issueType: issue.issue_type,
    altAction: issue.alternative_action,
  })),
  deadlines: [],
  actionNodes: marriageOptions.pathSteps.map((step, index) => ({
    id: `path-${index}`,
    title: step.title,
    actionKey: step.action_key,
    status: index === 0 ? "READY" : "BLOCKED",
    priority: index + 1,
  })),
  documents: [],
  unknowns: overlaid.unknowns.map((item) => ({ question: item.question })),
  evidenceGateStatus: overlaid.audit.status,
  conflicts: [],
});
assert(optionsPresentation.hero.current_posture === OPEN_OPTIONS_POSTURE, "open-options presentation must not fall back to raw status");
assert(!/STALE reconstruction|Case posture needs verification|upload a (uscis )?notice/i.test(JSON.stringify(optionsPresentation)), "open-options presentation must not show unverified case posture or notice-only next steps");
assert(optionsPresentation.findings.some((finding) => finding.group === "opportunity"), "open-options presentation should show pathway opportunities");
assert(presentationStepCta("ADD_CASE_DETAILS", "case-1")?.label === "Answer follow-up questions", "options follow-up CTA should not require a case file");
assert(presentationStepCta("REVIEW_ANALYSIS", "case-1")?.href === "/app/qa?case=case-1", "follow-up questions should still link to Q&A");

const qaFallback = buildQaFallbackAnswer({
  question: "I want to marry a US citizen. What can we do if we have not filed yet?",
  knowledge: "",
});
assert(/do not need a USCIS case/i.test(qaFallback), "Q&A without a case should still answer options questions");
assert(!/upload your USCIS notice/i.test(qaFallback), "Q&A fallback must not tell people with no file that they must upload a notice");
const listFromOptions = caseListSummaryFromView(
  { status: "analyzed", reconstructionPosition: "STALE reconstruction posture" },
  buildApprovedCaseView({
    canonical: buildCanonicalApprovedState({
      version: 1,
      reason: "analysis",
      pipelineConfigVersion: "v4.2-c1",
      evidenceSnapshotHash: "options-hash",
      status: "analyzed",
      readinessScore: 30,
      presentation: optionsPresentation,
    }),
    live: assemblePresentationContract({
      status: "analyzed",
      actionReadinessScore: 0,
      reconstruction: { currentPosition: "STALE reconstruction posture", summary: "stale", timeline: [], pendingActions: [] },
      issues: [],
      deadlines: [],
      actionNodes: [],
      documents: [],
    }),
  }),
);
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "case lists must show the approved open-options posture, not a stale reconstruction");

console.log("v3.2 immigration evidence check passed");
console.log(`- ${receipt.documentType}: ${receipt.facts.length} facts, ${receipt.events.length} events`);
console.log(`- ${rfe.documentType}: ${rfe.facts.length} facts, ${rfe.events.length} events`);
console.log(`- ${noid.documentType}, ${biometrics.documentType}, ${approval.documentType}: extra notice fixtures passed`);
console.log(`- universal extraction: ${universalRfe.facts.length} labeled facts, ${universalRfe.instructions_and_conditions.length} instructions`);
console.log(`- reconciled: ${reconciled.facts.length} facts, ${reconciled.events.length} events, ${reconciled.crossDocumentRelationships.length} cross-document link(s)`);
console.log(`- evidence gate: ${gate.status}, can analyze: ${gate.canAnalyze ? "yes" : "no"}`);
console.log("- action intelligence: case record, notice, and deadline satisfied from evidence");
console.log("- prompts: analyst, reviewer, and presenter are evidence-gate aware");
console.log(`- readiness split: available ${readiness.evidenceAvailableScore}, processed ${readiness.evidenceProcessedScore}, action ${readiness.actionReadinessScore}`);
console.log(`- letter guard: replaced ${guardedLetter.findings.length} unsupported value(s)`);
console.log(`- presentation contract: ${presentation.hero.current_posture}, next ${presentation.hero.next_best_action?.action_key}, ${presentation.findings.length} findings`);
console.log("- presentation UX: action statuses and evidence-gate labels are customer-facing");
console.log(`- case list: ${listFromContract.posture}, next ${listFromContract.nextActionTitle}`);
console.log("- case report: presentation contract sections are used for the printable report");
console.log("- v41 B5: letters, notices, and Q&A share approved presentation blocks");
console.log(`- v4 A10: analysis pipeline follows the case plan (${lowPlan.case_complexity}, skip process=${!lowDecisions.processDocuments}, runtime review=${runtimeDecisions.independentReview})`);
console.log(`- v4 A11: canonical approved state v${approvedState.version} stores ${approvedState.presentation?.hero.current_posture} and the analysis plan`);
console.log(`- v4 A12: ${selected?.source} approved state wins over stale stored/live presentations (${listFromCanonical.posture}, ${caseListVersionLine(listFromCanonical)})`);
console.log(`- v4 C1: open options ${marriageInquiry.mode}/${marriageOptions.reconstruction.currentPosition}, existing RFE ${rfeInquiry.mode}, F-1 ${studentInquiry.themes.join("+")}`);
