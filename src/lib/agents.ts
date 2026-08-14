import { AnalysisStage } from "@prisma/client";
import { getOpenAIClient } from "@/lib/openai";
import { mergeStageOutputs, ProviderStageOutput } from "@/lib/analysis/consensus";
import { getPlatformRuntimeSettings } from "@/lib/platform/settings";
import {
  CaseAnalysis,
  CaseGoal,
  CASE_GOAL_LABELS,
  DocumentRecord,
  TimelineEvent,
  CaseFinding,
  NextStep,
  CaseInconsistency,
  CaseHealth,
} from "@/types/case";

type RuntimeSettings = Awaited<ReturnType<typeof getPlatformRuntimeSettings>>;

function roleInstruction(role: ProviderStageOutput["role"]): string {
  switch (role) {
    case "FACT_EXTRACTOR":
      return "Role: FACT_EXTRACTOR. Return only objective extracted facts and avoid interpretation.";
    case "INTERPRETER":
      return "Role: INTERPRETER. Convert facts into clear meaning and practical implications with cautious language.";
    case "SKEPTIC":
      return "Role: SKEPTIC. Stress-test assumptions, identify uncertainty, and surface contradictions that need verification.";
    case "VERIFIER":
      return "Role: VERIFIER. Confirm consistency and completeness; explicitly note gaps and confidence limits.";
    case "PRESENTER":
      return "Role: PRESENTER. Produce user-facing plain language output that remains informational only.";
    default:
      return "Role: ANALYST. Keep outputs structured, accurate, and conservative.";
  }
}

async function runStagePrompt(
  stage: AnalysisStage,
  prompt: string,
  responseAsJson: boolean,
  settings: RuntimeSettings
): Promise<{ text: string; verificationRequired: boolean }> {
  const candidates = settings.pipeline[stage] ?? [];

  const outputs: ProviderStageOutput<{ text: string }>[] = [];

  for (const candidate of candidates) {
    const attemptedModels = [
      candidate.model,
      process.env[`OPENAI_FALLBACK_MODEL_${stage}`] ?? "gpt-4o",
    ];

    for (const model of attemptedModels) {
      try {
        const roleAwarePrompt = `${roleInstruction(candidate.role)}\n\n${prompt}`;
        const response = await getOpenAIClient().chat.completions.create({
          model,
          messages: [{ role: "user", content: roleAwarePrompt }],
          ...(responseAsJson ? { response_format: { type: "json_object" as const } } : {}),
          temperature: 0,
        });

        outputs.push({
          stage,
          providerLabel: candidate.providerLabel,
          model,
          role: candidate.role,
          payload: { text: response.choices[0].message.content ?? "" },
        });
        break;
      } catch {
        continue;
      }
    }
  }

  if (outputs.length === 0) {
    const response = await getOpenAIClient().chat.completions.create({
      model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      ...(responseAsJson ? { response_format: { type: "json_object" as const } } : {}),
      temperature: 0,
    });

    return {
      text: response.choices[0].message.content ?? "",
      verificationRequired: true,
    };
  }

  const consensus = mergeStageOutputs(outputs);
  return {
    text: consensus.merged.text,
    verificationRequired: consensus.verificationRequired,
  };
}

function tryParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function runDocumentIntelligence(
  extractedTexts: { name: string; text: string }[],
  settings: RuntimeSettings
): Promise<DocumentRecord[]> {
  if (extractedTexts.length === 0) return [];

  const BATCH_SIZE = 5;
  const MAX_CHARS_PER_DOC = 1500;
  const results: DocumentRecord[] = [];

  for (let i = 0; i < extractedTexts.length; i += BATCH_SIZE) {
    const batch = extractedTexts.slice(i, i + BATCH_SIZE);

    const prompt = `You are an immigration document intelligence specialist. For each document below, extract:
- formType
- receiptNumber
- aNumber
- dates
- status
- deadlines
- issues

Return a JSON object with key "documents" containing an array. Each element has: id (use document name), name, formType, receiptNumber, aNumber, dates (string[]), status, deadlines (string[]), issues (string[]).

Documents:
${batch.map((d, j) => `--- Document ${i + j + 1}: ${d.name} ---\n${d.text.slice(0, MAX_CHARS_PER_DOC)}`).join("\n\n")}`;

    const stage = await runStagePrompt("DOCUMENT", prompt, true, settings);
    const parsed = tryParseJson<{ documents?: DocumentRecord[] }>(stage.text, {});
    if (Array.isArray(parsed.documents)) results.push(...parsed.documents);
  }

  return results;
}

export async function runCaseReconstruction(
  narrative: string,
  documents: DocumentRecord[],
  settings: RuntimeSettings
): Promise<TimelineEvent[]> {
  const docSummary = documents
    .map(
      (d) =>
        `${d.name}: formType=${d.formType ?? "unknown"}, dates=${d.dates.join(", ")}, status=${d.status ?? "unknown"}`
    )
    .join("\n");

  const prompt = `You are an immigration case reconstruction specialist. Build a chronological timeline.

Narrative:
${narrative}

Document Records:
${docSummary}

Return JSON with key "timeline" as array of events: year, date?, event, source ("narrative"|"document"|"both"), formType?, receiptNumber?.`;

  const stage = await runStagePrompt("SUMMARY", prompt, true, settings);
  const parsed = tryParseJson<{ timeline?: TimelineEvent[] }>(stage.text, {});
  return parsed.timeline ?? [];
}

export async function runImmigrationResearch(
  situation: string,
  goals: CaseGoal[],
  settings: RuntimeSettings
): Promise<string> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");

  const prompt = `You are an immigration policy research specialist.

Situation: ${situation}
User Goals: ${goalLabels}

Provide concise summary covering applicable pathways, forms, eligibility standards, common issues, deadlines.
Cite USCIS Policy Manual, USCIS form instructions, INA, CFR. No legal advice.`;

  const stage = await runStagePrompt("GOAL", prompt, false, settings);
  return stage.text;
}

export async function runCaseAnalyst(
  narrative: string,
  goals: CaseGoal[],
  documents: DocumentRecord[],
  timeline: TimelineEvent[],
  research: string,
  settings: RuntimeSettings
): Promise<{
  caseHealth: CaseHealth;
  currentSituation: string;
  importantFindings: string[];
  deadlines: { label: string; date: string }[];
  findings: CaseFinding[];
  inconsistencies: CaseInconsistency[];
  documentsMissing: string[];
  majorIssues: number;
  rawAnalysis: string;
  verificationRequired?: boolean;
}> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");
  const docSummary = documents
    .map(
      (d) =>
        `${d.name} (${d.formType ?? "?"}): status=${d.status ?? "?"}, issues=${
          (d.issues ?? []).join(", ")
        }`
    )
    .join("\n");
  const timelineSummary = timeline
    .map((t) => `${t.year}${t.date ? ` (${t.date})` : ""}: ${t.event}`)
    .join("\n");

  const prompt = `You are an immigration case analyst. Return JSON with:
- caseHealth: good|needs_attention|critical
- currentSituation
- importantFindings
- deadlines: {label,date}[]
- findings: {label,status,detail?}[]
- inconsistencies: {field,narrativeSays,documentSays,severity}[]
- documentsMissing: string[]
- majorIssues: number
- rawAnalysis: 2-3 paragraphs

Narrative: ${narrative}
Goals: ${goalLabels}
Documents: ${docSummary}
Timeline: ${timelineSummary}
Research Context: ${research.slice(0, 2000)}

Use cautious language and avoid legal advice.`;

  const stage = await runStagePrompt("SITUATION", prompt, true, settings);

  const parsed = tryParseJson(stage.text, {
    caseHealth: "needs_attention" as CaseHealth,
    currentSituation: "Unable to determine current situation.",
    importantFindings: [],
    deadlines: [],
    findings: [],
    inconsistencies: [],
    documentsMissing: [],
    majorIssues: 0,
    rawAnalysis: "",
  });
  return {
    ...parsed,
    verificationRequired: stage.verificationRequired,
  };
}

export async function runExplanationEngine(
  rawAnalysis: string,
  goals: CaseGoal[],
  findings: CaseFinding[],
  inconsistencies: CaseInconsistency[],
  settings: RuntimeSettings
): Promise<{ plainLanguageSummary: string; nextSteps: NextStep[] }> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");
  const findingsSummary = findings
    .map((f) => `${f.status.toUpperCase()}: ${f.label}${f.detail ? ` — ${f.detail}` : ""}`)
    .join("\n");
  const inconsistenciesSummary =
    inconsistencies.length > 0
      ? inconsistencies
          .map(
            (i) =>
              `${i.field}: narrative says "${i.narrativeSays}", document says "${i.documentSays}"`
          )
          .join("\n")
      : "None detected";

  const prompt = `You are an immigration case explanation specialist.

Goals: ${goalLabels}
Analysis: ${rawAnalysis}
Findings: ${findingsSummary}
Inconsistencies: ${inconsistenciesSummary}

Return JSON:
- plainLanguageSummary (2-3 paragraphs, warm tone, no legal jargon, no legal advice)
- nextSteps: {option,title,description,recommended?}[]`;

  const stage = await runStagePrompt("PRESENTATION", prompt, true, settings);

  return tryParseJson(stage.text, {
    plainLanguageSummary:
      "We were unable to generate a plain language summary. Please review the findings above and consult with an immigration attorney.",
    nextSteps: [],
  });
}

export async function analyzeCase(
  narrative: string,
  goals: CaseGoal[],
  documentTexts: { name: string; text: string }[]
): Promise<CaseAnalysis> {
  const settings = await getPlatformRuntimeSettings();

  const documents = await runDocumentIntelligence(documentTexts, settings);

  const [timeline, research] = await Promise.all([
    runCaseReconstruction(narrative, documents, settings),
    runImmigrationResearch(narrative, goals, settings),
  ]);

  const analysis = await runCaseAnalyst(
    narrative,
    goals,
    documents,
    timeline,
    research,
    settings
  );

  const explanation = await runExplanationEngine(
    analysis.rawAnalysis,
    goals,
    analysis.findings,
    analysis.inconsistencies,
    settings
  );

  return {
    caseHealth: analysis.caseHealth,
    currentSituation: analysis.currentSituation,
    importantFindings: analysis.importantFindings,
    deadlines: analysis.deadlines,
    timeline,
    findings: analysis.findings,
    plainLanguageSummary: explanation.plainLanguageSummary,
    nextSteps: explanation.nextSteps,
    inconsistencies: analysis.inconsistencies,
    documentsReviewed: documentTexts.length,
    documentsMissing: analysis.documentsMissing,
    majorIssues: analysis.majorIssues,
    disclaimer: settings.disclaimer,
  };
}
