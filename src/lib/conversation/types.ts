/**
 * Phase −1 Conversation Intelligence — domain-neutral types.
 * Immigration / tax reasoning live in adapters; this layer stays product-agnostic.
 */

export const CONVERSATION_INTENTS = [
  "general_legal",
  "personal_eligibility",
  "procedural",
  "document_interpretation",
  "strategy_comparison",
  "status_update",
  "risk",
  "take_action",
  "information_only",
  "comprehensive_case_review",
] as const;

export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const RESPONSE_MODES = [
  "answer",
  "answer_then_targeted_questions",
  "clarify_first",
  "request_document",
  "initiate_case",
] as const;

export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const PIPELINE_IDS = ["assistant", "case"] as const;
export type PipelineId = (typeof PIPELINE_IDS)[number];

export const NEED_TO_KNOW_TIERS = ["critical_now", "soon", "later", "not_yet"] as const;
export type NeedToKnowTier = (typeof NEED_TO_KNOW_TIERS)[number];

export type QuestionContract = {
  explicit_question: string;
  interpreted_question: string;
  decision_target: string;
  current_scope: string;
  user_requested_action: boolean;
  requires_case_development: boolean;
};

export type Answerability = {
  fully_answerable: boolean;
  partially_answerable: boolean;
  requires_clarification: boolean;
  requires_document: boolean;
  clarify_first_required: boolean;
  clarify_first_reason: string;
};

export type NeedToKnowItem = {
  question: string;
  tier: NeedToKnowTier;
  reason: string;
  changes_branch: boolean;
  branches_affected: string[];
};

export type AnswerBranch = {
  id: string;
  condition: string;
  explanation: string;
};

export type IntentInterpretation = {
  primary_intent: ConversationIntent;
  domain: string;
  question: string;
  recommended_pipeline: PipelineId;
  recommended_response_mode: ResponseMode;
  routing_confidence: number;
  can_answer_partially_now: boolean;
  requires_personalized_analysis: boolean;
};

export type ResponseStrategy = {
  mode: ResponseMode;
  branch_before_clarify: boolean;
  branches: AnswerBranch[];
  ask_now: NeedToKnowItem[];
  ask_later: NeedToKnowItem[];
  provisional_answer_outline: string[];
};

export type ConversationRoute = {
  pipeline: PipelineId;
  reason: string;
  from_recommendation: PipelineId;
  confidence: number;
};

export type ConversationIntelligence = {
  question_contract: QuestionContract;
  intent: IntentInterpretation;
  answerability: Answerability;
  need_to_know: NeedToKnowItem[];
  strategy: ResponseStrategy;
  route: ConversationRoute;
};

export type ConversationMessageInput = {
  message: string;
  goal?: string | null;
  /** Prior user+assistant turns for continuity. */
  history?: { role: string; content: string }[];
  /** Documents attached to *this* turn. */
  documentCount?: number;
  /** Filename / notice hints (not content). */
  documentHints?: string[];
  /** User explicitly asked for case development. */
  forceCase?: boolean;
};

export function emptyQuestionContract(): QuestionContract {
  return {
    explicit_question: "",
    interpreted_question: "",
    decision_target: "understand_user_request",
    current_scope: "general",
    user_requested_action: false,
    requires_case_development: false,
  };
}
