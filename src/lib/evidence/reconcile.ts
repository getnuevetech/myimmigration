import type { ImmigrationFactKey } from "@/domain/facts";
import type {
  CompiledCaseEvent,
  CompiledCaseReconstruction,
  CompiledCaseUnknown,
  CompiledEvidenceAudit,
  CompiledEvidenceFact,
  CompiledEvidenceRelationship,
  CompiledEvidenceState,
  CompiledSuppressedQuestion,
  EvidenceConfidence,
} from "./types";

export type EvidenceConflict = {
  key: ImmigrationFactKey;
  values: string[];
  reason: string;
};

export type ReconciledEvidenceState = {
  facts: CompiledEvidenceFact[];
  events: CompiledCaseEvent[];
  relationships: CompiledEvidenceRelationship[];
  crossDocumentRelationships: CompiledEvidenceRelationship[];
  unknowns: CompiledCaseUnknown[];
  suppressedQuestions: CompiledSuppressedQuestion[];
  conflicts: EvidenceConflict[];
  audit: CompiledEvidenceAudit;
  reconstruction: CompiledCaseReconstruction;
};

const CORE_QUESTIONS: { key: ImmigrationFactKey; question: string; reason: string }[] = [
  {
    key: "receipt_number",
    question: "What USCIS receipt number connects the uploaded records?",
    reason: "Receipt numbers connect notices, filings, deadlines, and case status.",
  },
  {
    key: "form_type",
    question: "Which immigration form does this case involve?",
    reason: "Form type determines the relevant USCIS process and evidence rules.",
  },
];

const SINGLE_VALUE_KEYS: ImmigrationFactKey[] = ["a_number", "case_status"];

function factSignature(fact: CompiledEvidenceFact): string {
  return `${fact.key}\u0000${fact.value}\u0000${fact.source.documentId ?? ""}`;
}

function uniqueFacts(states: CompiledEvidenceState[]): CompiledEvidenceFact[] {
  const seen = new Set<string>();
  const facts: CompiledEvidenceFact[] = [];
  for (const state of states) {
    for (const fact of state.facts) {
      const sig = factSignature(fact);
      if (seen.has(sig)) continue;
      seen.add(sig);
      facts.push(fact);
    }
  }
  return facts;
}

function uniqueEvents(states: CompiledEvidenceState[]): CompiledCaseEvent[] {
  const events = states.flatMap((state) => state.events);
  return events
    .map((event, index) => ({ ...event, sortOrder: index }))
    .sort((a, b) => dateSortValue(a.dateText) - dateSortValue(b.dateText) || a.sortOrder - b.sortOrder)
    .map((event, index) => ({ ...event, sortOrder: index }));
}

function dateSortValue(value: string | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function factsByKey(facts: CompiledEvidenceFact[], key: ImmigrationFactKey): CompiledEvidenceFact[] {
  return facts.filter((fact) => fact.key === key);
}

function bestFact(facts: CompiledEvidenceFact[], key: ImmigrationFactKey): CompiledEvidenceFact | undefined {
  const priority: EvidenceConfidence[] = ["confirmed", "likely", "possible", "needs_verification", "not_supported"];
  return factsByKey(facts, key).sort((a, b) => priority.indexOf(a.confidence) - priority.indexOf(b.confidence))[0];
}

function uniqueValues(facts: CompiledEvidenceFact[], key: ImmigrationFactKey): string[] {
  return Array.from(new Set(factsByKey(facts, key).map((fact) => fact.value).filter(Boolean)));
}

function buildCrossDocumentRelationships(facts: CompiledEvidenceFact[]): CompiledEvidenceRelationship[] {
  const relationships: CompiledEvidenceRelationship[] = [];
  for (const key of ["receipt_number", "form_type"] as ImmigrationFactKey[]) {
    const byValue = new Map<string, CompiledEvidenceFact[]>();
    for (const fact of factsByKey(facts, key)) {
      const bucket = byValue.get(fact.value) ?? [];
      bucket.push(fact);
      byValue.set(fact.value, bucket);
    }
    for (const [value, matches] of byValue.entries()) {
      const documentIds = new Set(matches.map((fact) => fact.source.documentId).filter(Boolean));
      if (documentIds.size < 2) continue;
      relationships.push({
        relationType: key === "receipt_number" ? "same_receipt" : "same_form",
        fromFactKey: key,
        fromValue: value,
        toFactKey: key,
        toValue: value,
        confidence: "confirmed",
        rationale: `${key.replace(/_/g, " ")} ${value} appears in ${documentIds.size} separate documents.`,
      });
    }
  }
  return relationships;
}

function buildUnknowns(facts: CompiledEvidenceFact[], conflicts: EvidenceConflict[]): CompiledCaseUnknown[] {
  const unknowns: CompiledCaseUnknown[] = CORE_QUESTIONS
    .filter((item) => uniqueValues(facts, item.key).length === 0)
    .map((item) => ({ key: item.key, question: item.question, reason: item.reason }));

  for (const conflict of conflicts) {
    unknowns.push({
      key: `conflict_${conflict.key}`,
      question: `Which ${conflict.key.replace(/_/g, " ")} is correct?`,
      reason: conflict.reason,
    });
  }

  const hasRfe = uniqueValues(facts, "notice_type").includes("RFE");
  if (hasRfe && uniqueValues(facts, "response_deadline").length === 0) {
    unknowns.push({
      key: "response_deadline",
      question: "What response deadline is printed on the RFE?",
      reason: "The RFE response deadline controls when the response must reach USCIS.",
    });
  }

  return unknowns;
}

function buildSuppressedQuestions(facts: CompiledEvidenceFact[]): CompiledSuppressedQuestion[] {
  const suppressed: CompiledSuppressedQuestion[] = [];
  for (const key of ["receipt_number", "form_type", "response_deadline"] as ImmigrationFactKey[]) {
    const value = uniqueValues(facts, key)[0];
    if (!value) continue;
    suppressed.push({
      questionKey: key,
      question: `What is the ${key.replace(/_/g, " ")}?`,
      reason: `The evidence already shows ${key.replace(/_/g, " ")} ${value}.`,
      evidenceFactKey: key,
    });
  }
  return suppressed;
}

function detectConflicts(facts: CompiledEvidenceFact[]): EvidenceConflict[] {
  const conflicts: EvidenceConflict[] = [];
  for (const key of SINGLE_VALUE_KEYS) {
    const values = uniqueValues(facts, key);
    if (values.length > 1) {
      conflicts.push({
        key,
        values,
        reason: `Multiple ${key.replace(/_/g, " ")} values appear across the evidence.`,
      });
    }
  }
  return conflicts;
}

function buildAudit(facts: CompiledEvidenceFact[], unknowns: CompiledCaseUnknown[], conflicts: EvidenceConflict[]): CompiledEvidenceAudit {
  const warnings = conflicts.map((conflict) => conflict.reason);
  const hasCoreIds = uniqueValues(facts, "receipt_number").length > 0 && uniqueValues(facts, "form_type").length > 0;
  const blockingUnknowns = unknowns.map((item) => item.key);

  return {
    status: conflicts.length > 0 ? "needs_review" : hasCoreIds && blockingUnknowns.length === 0 ? "pass" : "needs_more_evidence",
    summary:
      conflicts.length > 0
        ? "The evidence has conflicts that need review before the case reconstruction is trusted."
        : hasCoreIds
          ? "The evidence has enough core identifiers for a case-level reconstruction."
          : "The evidence is missing core USCIS identifiers.",
    blockingUnknowns,
    warnings,
  };
}

function buildReconstruction(
  facts: CompiledEvidenceFact[],
  events: CompiledCaseEvent[],
  audit: CompiledEvidenceAudit,
): CompiledCaseReconstruction {
  const form = bestFact(facts, "form_type")?.value;
  const receipt = bestFact(facts, "receipt_number")?.value;
  const latestNotice = [...factsByKey(facts, "notice_type")].reverse()[0]?.value;
  const status = bestFact(facts, "case_status")?.value;
  const deadline = bestFact(facts, "response_deadline")?.value;
  const pendingActions = audit.blockingUnknowns.map((key) => `Confirm ${key.replace(/^conflict_/, "").replace(/_/g, " ")}`);

  if (latestNotice === "RFE" && deadline) pendingActions.unshift(`Prepare the RFE response by ${deadline}`);

  return {
    summary: [form, receipt, latestNotice].filter(Boolean).length
      ? `Evidence links ${[form, receipt, latestNotice].filter(Boolean).join(" / ")}.`
      : "Evidence does not yet identify the immigration case posture.",
    currentPosition: status ?? (latestNotice ? `${latestNotice} notice needs review` : "Case posture needs verification"),
    timeline: events,
    pendingActions,
    confidence: audit.status === "pass" ? "confirmed" : audit.status === "needs_review" ? "possible" : "needs_verification",
  };
}

export function reconcileEvidenceStates(states: CompiledEvidenceState[]): ReconciledEvidenceState {
  const facts = uniqueFacts(states);
  const events = uniqueEvents(states);
  const relationships = states.flatMap((state) => state.relationships);
  const crossDocumentRelationships = buildCrossDocumentRelationships(facts);
  const conflicts = detectConflicts(facts);
  const unknowns = buildUnknowns(facts, conflicts);
  const suppressedQuestions = buildSuppressedQuestions(facts);
  const audit = buildAudit(facts, unknowns, conflicts);
  const reconstruction = buildReconstruction(facts, events, audit);

  return {
    facts,
    events,
    relationships,
    crossDocumentRelationships,
    unknowns,
    suppressedQuestions,
    conflicts,
    audit,
    reconstruction,
  };
}
