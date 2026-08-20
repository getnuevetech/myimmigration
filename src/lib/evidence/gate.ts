import type { ReconciledEvidenceState } from "./reconcile";
import type { CompiledCaseEvent, CompiledCaseUnknown, CompiledEvidenceAudit, CompiledEvidenceFact, CompiledSuppressedQuestion } from "./types";

export type EvidenceGateBriefInput = {
  audit: CompiledEvidenceAudit;
  reconstruction: {
    summary: string;
    currentPosition: string;
    pendingActions: string[];
  };
  facts: CompiledEvidenceFact[];
  events: CompiledCaseEvent[];
  unknowns: CompiledCaseUnknown[];
  suppressedQuestions: CompiledSuppressedQuestion[];
};

export type EvidenceGateBrief = {
  status: CompiledEvidenceAudit["status"];
  canAnalyze: boolean;
  mustGroundClaims: true;
  summary: string;
  currentPosition: string;
  pendingActions: string[];
  unknowns: CompiledCaseUnknown[];
  suppressedQuestions: CompiledSuppressedQuestion[];
  facts: { key: string; value: string; confidence: string; source: string }[];
  events: { eventType: string; title: string; dateText: string }[];
  promptText: string;
};

function factSource(fact: CompiledEvidenceFact): string {
  return fact.source.label || fact.source.documentId || fact.source.kind;
}

function formatPromptText(brief: Omit<EvidenceGateBrief, "promptText">): string {
  const facts = brief.facts.length
    ? brief.facts.map((fact) => `- ${fact.key}: ${fact.value} (${fact.confidence}, source: ${fact.source})`).join("\n")
    : "- No evidence facts have been compiled yet.";
  const events = brief.events.length
    ? brief.events.map((event) => `- ${event.dateText ? `${event.dateText}: ` : ""}${event.title} [${event.eventType}]`).join("\n")
    : "- No evidence events have been compiled yet.";
  const unknowns = brief.unknowns.length
    ? brief.unknowns.map((item) => `- ${item.question} Reason: ${item.reason}`).join("\n")
    : "- No blocking unknowns remain in the compiled evidence.";
  const pending = brief.pendingActions.length
    ? brief.pendingActions.map((item) => `- ${item}`).join("\n")
    : "- No pending evidence-derived action is available.";

  return [
    `EVIDENCE GATE STATUS: ${brief.status}`,
    `CAN ANALYZE: ${brief.canAnalyze ? "yes" : "only for missing-evidence guidance"}`,
    "GROUNDING RULE: Every conclusion, deadline, form, receipt number, and requested action must be supported by the compiled evidence, the applicant narrative, or authoritative USCIS reference material. Treat unsupported details as unknowns.",
    `CURRENT POSITION: ${brief.currentPosition}`,
    `SUMMARY: ${brief.summary}`,
    "KNOWN EVIDENCE FACTS:",
    facts,
    "EVIDENCE TIMELINE:",
    events,
    "UNRESOLVED UNKNOWNS:",
    unknowns,
    "EVIDENCE-DERIVED PENDING ACTIONS:",
    pending,
  ].join("\n");
}

export function buildEvidenceGateBrief(input: EvidenceGateBriefInput): EvidenceGateBrief {
  const compact: Omit<EvidenceGateBrief, "promptText"> = {
    status: input.audit.status,
    canAnalyze: input.audit.status === "pass" || input.audit.status === "needs_more_evidence",
    mustGroundClaims: true,
    summary: input.audit.summary || input.reconstruction.summary,
    currentPosition: input.reconstruction.currentPosition || "Case posture needs verification",
    pendingActions: input.reconstruction.pendingActions.slice(0, 8),
    unknowns: input.unknowns.slice(0, 12),
    suppressedQuestions: input.suppressedQuestions.slice(0, 12),
    facts: input.facts.slice(0, 40).map((fact) => ({
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      source: factSource(fact),
    })),
    events: input.events.slice(0, 20).map((event) => ({
      eventType: event.eventType,
      title: event.title,
      dateText: event.dateText ?? "",
    })),
  };

  return { ...compact, promptText: formatPromptText(compact) };
}

export function buildEvidenceGateBriefFromReconciled(reconciled: ReconciledEvidenceState): EvidenceGateBrief {
  return buildEvidenceGateBrief({
    audit: reconciled.audit,
    reconstruction: reconciled.reconstruction,
    facts: reconciled.facts,
    events: reconciled.events,
    unknowns: reconciled.unknowns,
    suppressedQuestions: reconciled.suppressedQuestions,
  });
}
