import { evaluateAnswerability } from "./answerability";
import { routeConversation } from "./conversation-router";
import { detectGovernmentMatter } from "./government-matter";
import { interpretIntent } from "./intent-interpreter";
import { buildExperienceRecord, learningEventFromExperience } from "@/lib/experience/experience-record";
import { buildNeedToKnow } from "./need-to-know";
import { buildQuestionContract } from "./question-contract";
import { buildResponseStrategy } from "./response-strategy";
import type { ConversationIntelligence, ConversationMessageInput, QuestionContract } from "./types";

const LOW_CONFIDENCE = 0.8;

/** Full Phase −1 / Phase S pipeline: contract → intent → answerability → need-to-know → strategy → router → learning event. */
export function runConversationIntelligence(input: ConversationMessageInput): ConversationIntelligence {
  const message = String(input.message ?? "").trim();
  const question_contract = buildQuestionContract(input);
  const intent = interpretIntent({ ...input });
  intent.question = question_contract.interpreted_question || intent.question;
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
  const matter = detectGovernmentMatter([message, input.goal ?? ""].join("\n"), input.documentHints);
  const strategy = buildResponseStrategy({
    contract: question_contract,
    intent,
    answerability,
    needToKnow: need_to_know,
    message,
    allowCaseReview: matter.existing_government_case,
  });
  const route = routeConversation({
    contract: question_contract,
    intent,
    answerability,
    strategy,
    message,
    documentCount: input.documentCount,
    documentHints: input.documentHints,
    forceCase: input.forceCase,
  });

  strategy.mode = route.response_mode;

  const experience_record = buildExperienceRecord({
    contract: question_contract,
    workspace: route.workspace,
    responseMode: route.response_mode,
    existingGovernmentCase: route.existing_government_case,
    interactionIntent: intent.interaction_intent,
    pathways: strategy.branches.map((b) => b.id),
    askNow: strategy.ask_now,
    documentsUsed: input.documentHints ?? [],
  });
  const learning_event = learningEventFromExperience(experience_record);

  return {
    question_contract,
    intent,
    answerability,
    need_to_know,
    strategy,
    route,
    learning_event,
    experience_record,
  };
}

export function parseStoredIntelligence(raw: string | null | undefined): ConversationIntelligence | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConversationIntelligence;
    if (!parsed?.question_contract?.decision_target) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function priorContractFromStored(raw: string | null | undefined): QuestionContract | null {
  return parseStoredIntelligence(raw)?.question_contract ?? null;
}

/**
 * Optional Sol enrichment when heuristic confidence is low.
 * Never invents document facts; only may refine interpreted_question / decision_target labels.
 * Falls back silently when no PRIMARY_REASONING provider/key is available.
 */
export async function enrichIntelligenceWithReasoningModel(
  intel: ConversationIntelligence,
  input: ConversationMessageInput,
): Promise<ConversationIntelligence> {
  if (intel.intent.routing_confidence >= LOW_CONFIDENCE) return intel;
  if (intel.route.invokes_case_engine) return intel;

  try {
    const { resolveCapabilityProvider } = await import("@/lib/ai/model-capabilities");
    const { callProvider, extractJson } = await import("@/lib/ai/adapters");
    const provider = await resolveCapabilityProvider("primary_reasoning");
    if (!provider?.apiKey) return intel;

    const prompt = `You refine a conversation Question Contract. Return ONLY JSON:
{"interpreted_question":"","decision_target":"","routing_confidence":0.0,"primary_intent":""}
Rules: do not invent document facts; do not set requires_case_development true unless the user asked for a full case/strategy on an existing government matter; keep decision_target stable if this is a follow-up.
PRIOR_CONTRACT: ${JSON.stringify(intel.question_contract)}
MESSAGE: ${input.message}
GOAL: ${input.goal ?? ""}`;

    const result = await callProvider(provider, [{ role: "user", content: prompt }]);
    const data = extractJson(result.text) as Record<string, unknown> | null;
    if (!data) return intel;

    const interpreted = String(data.interpreted_question ?? "").trim();
    const target = String(data.decision_target ?? "").trim();
    const confidence = Number(data.routing_confidence);
    const nextContract = {
      ...intel.question_contract,
      interpreted_question: interpreted || intel.question_contract.interpreted_question,
      decision_target: target || intel.question_contract.decision_target,
    };
    return {
      ...intel,
      question_contract: nextContract,
      intent: {
        ...intel.intent,
        question: nextContract.interpreted_question,
        routing_confidence: Number.isFinite(confidence)
          ? Math.min(0.95, Math.max(intel.intent.routing_confidence, confidence))
          : Math.min(0.9, intel.intent.routing_confidence + 0.05),
      },
    };
  } catch {
    return intel;
  }
}

export function isQuestionShapedCaseNarrative(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  return (
    !intel.route.invokes_case_engine &&
    !intel.answerability.clarify_first_required &&
    (intel.strategy.provisional_answer_outline.length > 0 || intel.strategy.branches.length > 0)
  );
}

export function caseMustAnswerBeforeClarify(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  if (intel.answerability.clarify_first_required) return false;
  return isQuestionShapedCaseNarrative(situation, goal) || !intel.route.invokes_case_engine;
}
