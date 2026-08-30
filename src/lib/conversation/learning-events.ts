import type {
  ConversationIntelligence,
  InteractionIntent,
  LearningEvent,
  NeedToKnowItem,
  QuestionContract,
  ResponseMode,
  WorkspaceId,
} from "./types";
import { canonicalizeResponseMode, invokesCaseEngine } from "./types";

const LOW_VALUE_EARLY = ["medical_exam", "priority_date", "financial_sponsorship_details", "passport_upload", "marriage_evidence_checklist"];

/**
 * Structured learning event emitted every turn (S1 hooks; S7 consumes later).
 * Never include raw PII — only contracts, modes, and fact *keys*.
 */
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
  const mode = canonicalizeResponseMode(opts.responseMode);
  const ask = opts.askNow[0] ?? null;
  return {
    question_contract: opts.contract,
    workspace_selected: opts.workspace,
    decision_target: opts.contract.decision_target,
    pathways_considered: opts.pathways,
    clarification_selected: ask ? summarizeClarificationKey(ask.question) : null,
    clarification_reason: ask?.reason ?? null,
    questions_suppressed: opts.suppressed?.length ? opts.suppressed : defaultSuppressed(opts.contract),
    response_mode: mode,
    invokes_case_engine: invokesCaseEngine(mode),
    existing_government_case: opts.existingGovernmentCase,
    interaction_intent: opts.interactionIntent,
  };
}

export function learningEventFromIntelligence(intel: ConversationIntelligence): LearningEvent {
  return intel.learning_event;
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
    return LOW_VALUE_EARLY;
  }
  return ["medical_exam"];
}

/** Guard: pathway-style targets must never surface medical-exam as the active ask. */
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
