import type {
  Answerability,
  ConversationRoute,
  IntentInterpretation,
  PipelineId,
  QuestionContract,
  ResponseStrategy,
} from "./types";

export type RouterInput = {
  contract: QuestionContract;
  intent: IntentInterpretation;
  answerability: Answerability;
  strategy: ResponseStrategy;
  documentCount?: number;
  forceCase?: boolean;
};

/**
 * Conversation Router — sole authority for pipeline choice.
 * Document upload alone never selects case.
 */
export function routeConversation(input: RouterInput): ConversationRoute {
  const recommended = input.intent.recommended_pipeline;
  const confidence = input.intent.routing_confidence;
  const docs = input.documentCount ?? 0;

  if (input.forceCase || input.contract.requires_case_development || input.strategy.mode === "initiate_case") {
    return {
      pipeline: "case",
      reason: "User requested comprehensive case development or decision target requires full case machinery.",
      from_recommendation: recommended,
      confidence: Math.max(confidence, 0.9),
    };
  }

  // Upload + interpret/explain → assistant
  if (docs > 0 && input.contract.decision_target === "explain_document_or_notice") {
    return {
      pipeline: "assistant",
      reason: "Document attached for interpretation; upload alone does not promote to case.",
      from_recommendation: recommended,
      confidence: Math.max(confidence, 0.92),
    };
  }

  if (docs > 0 && !input.contract.requires_case_development) {
    return {
      pipeline: "assistant",
      reason: "Documents validate or explain facts for the current question; they do not gate case intake.",
      from_recommendation: "assistant",
      confidence: Math.max(confidence, 0.9),
    };
  }

  // Default safe: question-shaped → assistant
  const pipeline: PipelineId = recommended === "case" ? "case" : "assistant";
  return {
    pipeline,
    reason:
      pipeline === "assistant"
        ? "Question contract is answerable in assistant mode; case engine not required."
        : "Router accepted case recommendation for comprehensive development.",
    from_recommendation: recommended,
    confidence,
  };
}

/** Promotion A→B: never from upload alone. */
export function mayPromoteAssistantToCase(opts: {
  contract: QuestionContract;
  userExplicitlyRequestsCase: boolean;
  documentCount?: number;
}): { allowed: boolean; reason: string } {
  if (opts.userExplicitlyRequestsCase || opts.contract.requires_case_development) {
    return { allowed: true, reason: "Explicit or contextual case-development request." };
  }
  if ((opts.documentCount ?? 0) > 0) {
    return { allowed: false, reason: "Document upload alone must never trigger A→B promotion." };
  }
  return { allowed: false, reason: "No case-development signal on the question contract." };
}
