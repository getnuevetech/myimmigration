import { getOpenAIClient } from "@/lib/openai";
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

const DISCLAIMER =
  "This analysis is for informational and organizational purposes only. It does not constitute legal advice and does not create an attorney-client relationship. Immigration law is complex and fact-specific. Please consult a licensed immigration attorney or accredited representative before making any immigration decisions or filing any forms.";

/**
 * Agent 1 — Document Intelligence
 * Extracts structured data from each uploaded document's text.
 */
export async function runDocumentIntelligence(
  extractedTexts: { name: string; text: string }[]
): Promise<DocumentRecord[]> {
  if (extractedTexts.length === 0) return [];

  const prompt = `You are an immigration document intelligence specialist. For each document below, extract:
- formType (e.g. I-797, I-485, I-130, I-765, N-400, I-589, I-94, visa stamp, RFE, NOID, EAD, DS-160)
- receiptNumber (e.g. MSC2190123456)
- aNumber (Alien Registration Number, e.g. A123456789)
- dates (all relevant dates found: filing date, approval date, expiration date, etc.)
- status (e.g. Approved, Pending, Denied, RFE Issued)
- deadlines (any response deadlines or expiration dates)
- issues (any problems, conflicts, or requests for evidence mentioned)

Return a JSON array. Each element has: id (use document name), name, formType, receiptNumber, aNumber, dates (string[]), status, deadlines (string[]), issues (string[]).

Documents:
${extractedTexts.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.text.slice(0, 3000)}`).join("\n\n")}`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content ?? "{}");
    return (parsed.documents ?? parsed) as DocumentRecord[];
  } catch {
    return [];
  }
}

/**
 * Agent 2 — Case Reconstruction
 * Builds a structured timeline from narrative + documents.
 */
export async function runCaseReconstruction(
  narrative: string,
  documents: DocumentRecord[]
): Promise<TimelineEvent[]> {
  const docSummary = documents
    .map(
      (d) =>
        `${d.name}: formType=${d.formType ?? "unknown"}, dates=${d.dates.join(", ")}, status=${d.status ?? "unknown"}`
    )
    .join("\n");

  const prompt = `You are an immigration case reconstruction specialist. Given the person's narrative and their document records, build a chronological immigration timeline.

Narrative:
${narrative}

Document Records:
${docSummary}

Return a JSON object with key "timeline" containing an array of events. Each event: year (4-digit string), date (optional ISO date), event (plain description of what happened), source ("narrative" | "document" | "both"), formType (optional), receiptNumber (optional).

Order events chronologically. Include all significant immigration events: entries, visa applications, status changes, filings, approvals, denials, RFEs, interviews, separations, naturalizations, etc.`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content ?? "{}");
    return (parsed.timeline ?? []) as TimelineEvent[];
  } catch {
    return [];
  }
}

/**
 * Agent 3 — Immigration Research
 * Retrieves relevant USCIS policy context for the user's situation.
 * (In production this would use RAG against USCIS Policy Manual; here we use the model's
 * knowledge with a strict instruction to cite authoritative sources only.)
 */
export async function runImmigrationResearch(
  situation: string,
  goals: CaseGoal[]
): Promise<string> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");

  const prompt = `You are an immigration policy research specialist. Your job is to identify the relevant USCIS policies, form requirements, and regulatory standards that apply to the following situation.

Situation: ${situation}
User Goals: ${goalLabels}

Provide a concise research summary covering:
1. Applicable immigration categories/pathways
2. Relevant USCIS forms and requirements
3. Key eligibility standards from the USCIS Policy Manual
4. Common issues that arise in similar cases
5. Relevant deadlines or time constraints

Cite only authoritative sources (USCIS Policy Manual, USCIS forms instructions, INA, CFR). Do NOT give legal advice. Focus on published government requirements only.`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  return response.choices[0].message.content ?? "";
}

/**
 * Agent 4 — Case Analyst
 * Cross-compares facts + documents + research + goals to surface issues and options.
 */
export async function runCaseAnalyst(
  narrative: string,
  goals: CaseGoal[],
  documents: DocumentRecord[],
  timeline: TimelineEvent[],
  research: string
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
}> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");
  const docSummary = documents
    .map(
      (d) =>
        `${d.name} (${d.formType ?? "?"}): status=${d.status ?? "?"}, issues=${(d.issues ?? []).join(", ")}`
    )
    .join("\n");
  const timelineSummary = timeline
    .map((t) => `${t.year}${t.date ? ` (${t.date})` : ""}: ${t.event}`)
    .join("\n");

  const prompt = `You are an immigration case analyst. Analyze this case carefully and return a JSON object.

Narrative: ${narrative}
Goals: ${goalLabels}
Documents: ${docSummary}
Timeline: ${timelineSummary}
Research Context: ${research.slice(0, 2000)}

Return JSON with:
- caseHealth: "good" | "needs_attention" | "critical"
- currentSituation: one sentence describing current immigration situation
- importantFindings: string[] (up to 5 most important findings)
- deadlines: array of {label: string, date: string} for any upcoming deadlines
- findings: array of {label: string, status: "ok"|"warning"|"missing"|"critical", detail?: string}
  (cover: primary application, supporting evidence, financial evidence, medical exam, petitioner support, address history, prior applications, travel history)
- inconsistencies: array of {field: string, narrativeSays: string, documentSays: string, severity: "warning"|"critical"}
  (flag any date/name/status mismatches between narrative and documents)
- documentsMissing: string[] of document types likely needed but not found
- majorIssues: number (count of critical/warning issues)
- rawAnalysis: string (2-3 paragraph analytical summary for the explanation engine)

IMPORTANT: Do not give legal advice. Note issues as "may need attention" or "appears to be". Use cautious language.`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    return {
      caseHealth: "needs_attention",
      currentSituation: "Unable to determine current situation.",
      importantFindings: [],
      deadlines: [],
      findings: [],
      inconsistencies: [],
      documentsMissing: [],
      majorIssues: 0,
      rawAnalysis: "",
    };
  }
}

/**
 * Agent 5 — Explanation Engine
 * Converts analytical output into plain language an ordinary immigrant can understand.
 */
export async function runExplanationEngine(
  rawAnalysis: string,
  goals: CaseGoal[],
  findings: CaseFinding[],
  inconsistencies: CaseInconsistency[]
): Promise<{ plainLanguageSummary: string; nextSteps: NextStep[] }> {
  const goalLabels = goals.map((g) => CASE_GOAL_LABELS[g]).join("; ");
  const findingsSummary = findings
    .map((f) => `${f.status.toUpperCase()}: ${f.label}${f.detail ? ` — ${f.detail}` : ""}`)
    .join("\n");
  const inconsistenciesSummary =
    inconsistencies.length > 0
      ? inconsistencies.map((i) => `${i.field}: narrative says "${i.narrativeSays}", document says "${i.documentSays}"`).join("\n")
      : "None detected";

  const prompt = `You are an immigration case explanation specialist. Your job is to translate complex immigration analysis into clear, compassionate language that someone with no legal background can understand.

Goals: ${goalLabels}
Analysis: ${rawAnalysis}
Findings: ${findingsSummary}
Inconsistencies: ${inconsistenciesSummary}

Return JSON with:
- plainLanguageSummary: 2-3 paragraphs in plain, warm, reassuring language explaining what is happening with the case, what was found, and what it means for the person. No legal jargon. Use "may", "appears to", "it looks like" language. End with a reminder to consult an immigration attorney.
- nextSteps: array of {option: string (e.g. "Option A"), title: string, description: string, recommended?: boolean}
  Provide 2-4 realistic next steps. Use language like "you may want to consider" and "an immigration attorney can help determine whether...". Never say "you qualify for" or "you should file".`;

  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  try {
    return JSON.parse(response.choices[0].message.content ?? "{}");
  } catch {
    return {
      plainLanguageSummary:
        "We were unable to generate a plain language summary. Please review the findings above and consult with an immigration attorney.",
      nextSteps: [],
    };
  }
}

/**
 * Orchestrator — runs all 5 agents in sequence and assembles CaseAnalysis.
 */
export async function analyzeCase(
  narrative: string,
  goals: CaseGoal[],
  documentTexts: { name: string; text: string }[]
): Promise<CaseAnalysis> {
  // Agent 1: Document Intelligence
  const documents = await runDocumentIntelligence(documentTexts);

  // Agent 2: Case Reconstruction
  const timeline = await runCaseReconstruction(narrative, documents);

  // Agent 3: Immigration Research
  const research = await runImmigrationResearch(narrative, goals);

  // Agent 4: Case Analyst
  const analysis = await runCaseAnalyst(narrative, goals, documents, timeline, research);

  // Agent 5: Explanation Engine
  const explanation = await runExplanationEngine(
    analysis.rawAnalysis,
    goals,
    analysis.findings,
    analysis.inconsistencies
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
    disclaimer: DISCLAIMER,
  };
}
