import { evaluateAnswerability } from "./answerability";
import { routeConversation } from "./conversation-router";
import { interpretIntent } from "./intent-interpreter";
import { buildNeedToKnow } from "./need-to-know";
import { buildQuestionContract } from "./question-contract";
import { buildResponseStrategy } from "./response-strategy";
import type { ConversationIntelligence, ConversationMessageInput } from "./types";

/** Full Phase −1 pipeline: contract → intent → answerability → need-to-know → strategy → router. */
export function runConversationIntelligence(input: ConversationMessageInput): ConversationIntelligence {
  const message = String(input.message ?? "").trim();
  const question_contract = buildQuestionContract(input);
  const intent = interpretIntent(input);
  const answerability = evaluateAnswerability({
    contract: question_contract,
    intent,
    message,
    documentCount: input.documentCount,
  });
  const need_to_know = buildNeedToKnow({
    contract: question_contract,
    message,
    answerability,
  });
  const strategy = buildResponseStrategy({
    contract: question_contract,
    intent,
    answerability,
    needToKnow: need_to_know,
    message,
  });
  const route = routeConversation({
    contract: question_contract,
    intent,
    answerability,
    strategy,
    documentCount: input.documentCount,
    forceCase: input.forceCase,
  });

  return {
    question_contract,
    intent,
    answerability,
    need_to_know,
    strategy,
    route,
  };
}

export function isQuestionShapedCaseNarrative(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  return (
    !intel.question_contract.requires_case_development &&
    !intel.answerability.clarify_first_required &&
    (intel.strategy.provisional_answer_outline.length > 0 || intel.strategy.branches.length > 0)
  );
}

export function caseMustAnswerBeforeClarify(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  if (intel.answerability.clarify_first_required) return false;
  return isQuestionShapedCaseNarrative(situation, goal) || intel.route.pipeline === "assistant";
}
