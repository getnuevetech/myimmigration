/**
 * Phase −1.9 / L0 — structured experience capture (no production retrieval yet).
 * Matches the S0-locked L0 shape; de-identification and Pattern Registry come in L1–L5.
 */

import type {
  ConversationIntelligence,
  InteractionIntent,
  LearningEvent,
  NeedToKnowItem,
  QuestionContract,
  ResponseMode,
  WorkspaceId,
} from "../conversation/types";
import { canonicalizeResponseMode, invokesCaseEngine } from "../conversation/types";
import { MEDICAL_EXAM_NEGATIVE_LESSON } from "./negative-lessons";

const LOW_VALUE_EARLY = [
  "medical_exam",
  "priority_date",
  "financial_sponsorship_details",
  "passport_upload",
  "marriage_evidence_checklist",
];

export type ClarificationSelected = {
  key: string;
  question: string;
  reason: string;
} | null;

/** Full L0 ExperienceRecord fields (persisted as JSON on Situation / later ExperienceRecord table). */
export type ExperienceRecordV0 = {
  schema_version: "l0";
  question_contract: QuestionContract;
  workspace: WorkspaceId;
  decision_target: string;
  facts_considered: string[];
  decision_changing_facts: string[];
  facts_not_needed_yet: string[];
  pathways_considered: string[];
  clarification_selected: ClarificationSelected;
  clarifications_suppressed: string[];
  documents_used: string[];
  authority_ids: string[];
  answer_changed_after_clarification: boolean;
  model_correction: null | { note: string };
  reviewer_correction: null | { note: string };
  outcome: null | { kind: string; detail: string };
  /** Convenience mirrors for Phase S learning_event consumers. */
  response_mode: ResponseMode;
  invokes_case_engine: boolean;
  existing_government_case: boolean;
  interaction_intent: InteractionIntent;
  negative_lesson_ids: string[];
};

/**
 * Build L0 experience capture for a turn.
 * Never include raw PII — only contracts, modes, and fact *keys*.
 */
export function buildExperienceRecord(opts: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  factsConsidered?: string[];
  decisionChangingFacts?: string[];
  documentsUsed?: string[];
  authorityIds?: string[];
  answerChangedAfterClarification?: boolean;
}): ExperienceRecordV0 {
  const mode = canonicalizeResponseMode(opts.responseMode);
  const ask = opts.askNow[0] ?? null;
  const suppressed = defaultSuppressed(opts.contract);
  const negativeIds: string[] = [];
  if (
    opts.contract.decision_target === "identify_available_pathways" ||
    opts.contract.decision_target === "petition_eligibility_overview"
  ) {
    negativeIds.push(MEDICAL_EXAM_NEGATIVE_LESSON.id);
  }

  return {
    schema_version: "l0",
    question_contract: opts.contract,
    workspace: opts.workspace,
    decision_target: opts.contract.decision_target,
    facts_considered: opts.factsConsidered ?? [],
    decision_changing_facts:
      opts.decisionChangingFacts ??
      (ask ? [summarizeClarificationKey(ask.question)] : []),
    facts_not_needed_yet: suppressed,
    pathways_considered: opts.pathways,
    clarification_selected: ask
      ? {
          key: summarizeClarificationKey(ask.question),
          question: ask.question,
          reason: ask.reason,
        }
      : null,
    clarifications_suppressed: suppressed,
    documents_used: opts.documentsUsed ?? [],
    authority_ids: opts.authorityIds ?? [],
    answer_changed_after_clarification: opts.answerChangedAfterClarification ?? false,
    model_correction: null,
    reviewer_correction: null,
    outcome: null,
    response_mode: mode,
    invokes_case_engine: invokesCaseEngine(mode),
    existing_government_case: opts.existingGovernmentCase,
    interaction_intent: opts.interactionIntent,
    negative_lesson_ids: negativeIds,
  };
}

/** Back-compat LearningEvent shape used by ConversationIntelligence. */
export function learningEventFromExperience(record: ExperienceRecordV0): LearningEvent {
  return {
    question_contract: record.question_contract,
    workspace_selected: record.workspace,
    decision_target: record.decision_target,
    pathways_considered: record.pathways_considered,
    clarification_selected: record.clarification_selected?.key ?? null,
    clarification_reason: record.clarification_selected?.reason ?? null,
    questions_suppressed: record.clarifications_suppressed,
    response_mode: record.response_mode,
    invokes_case_engine: record.invokes_case_engine,
    existing_government_case: record.existing_government_case,
    interaction_intent: record.interaction_intent,
  };
}

export function buildLearningEvent(opts: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  suppressed?: string[];
}): LearningEvent {
  const record = buildExperienceRecord({
    ...opts,
    existingGovernmentCase: opts.existingGovernmentCase,
  });
  if (opts.suppressed?.length) {
    record.clarifications_suppressed = opts.suppressed;
    record.facts_not_needed_yet = opts.suppressed;
  }
  return learningEventFromExperience(record);
}

export function learningEventFromIntelligence(intel: ConversationIntelligence): LearningEvent {
  return intel.learning_event;
}

export function assertNoPrematureSchemaAsk(ask: NeedToKnowItem | undefined, decisionTarget: string): boolean {
  if (!ask) return true;
  if (
    decisionTarget !== "identify_available_pathways" &&
    decisionTarget !== "petition_eligibility_overview"
  ) {
    return true;
  }
  return !/medical\s*exam|i-?693|priority\s*date|passport|i-?864|affidavit of support/i.test(ask.question);
}

function summarizeClarificationKey(question: string): string {
  const q = question.toLowerCase();
  if (/inspect|parole|admitted|without inspection|border|entry/.test(q)) return "manner_of_entry";
  if (/removal|nta|i-?862|proceedings/.test(q)) return "removal_proceedings";
  if (/form|notice number/.test(q)) return "notice_identity";
  return "targeted_clarification";
}

function defaultSuppressed(contract: QuestionContract): string[] {
  if (
    contract.decision_target === "identify_available_pathways" ||
    contract.decision_target === "petition_eligibility_overview"
  ) {
    return [...LOW_VALUE_EARLY];
  }
  return ["medical_exam"];
}
