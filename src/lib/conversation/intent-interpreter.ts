import { buildQuestionContract } from "./question-contract";
import type {
  ConversationIntent,
  ConversationMessageInput,
  IntentInterpretation,
  PipelineId,
  ResponseMode,
} from "./types";

function detectDomain(text: string): string {
  if (/\b(irs|tax|cp\d+|offer in compromise|installment agreement)\b/i.test(text)) return "tax_collection";
  if (/\b(i-?862|nta|removal|deport)\b/i.test(text)) return "removal_defense";
  if (/\b(wife|husband|spouse|marriage|i-?130|family)\b/i.test(text)) return "family_based_immigration";
  if (/\b(rfe|noid|i-?797|receipt|uscis)\b/i.test(text)) return "uscis_notice";
  if (/\b(green card|visa|immigration|border|parole|ewi)\b/i.test(text)) return "immigration_general";
  return "general";
}

function detectIntent(text: string, contractTarget: string): ConversationIntent {
  if (contractTarget === "comprehensive_case_strategy") return "comprehensive_case_review";
  if (contractTarget === "explain_document_or_notice") return "document_interpretation";
  if (contractTarget === "document_checklist") return "procedural";
  if (contractTarget === "identify_available_pathways") return "personal_eligibility";
  if (contractTarget === "petition_eligibility_overview") return "personal_eligibility";
  if (contractTarget === "status_guidance") return "status_update";
  if (contractTarget === "risk_overview") return "risk";
  if (contractTarget === "interpret_situation_offer_next_step") return "information_only";
  if (/\b(compare|versus|vs\.?|which (is|path) better)\b/i.test(text)) return "strategy_comparison";
  if (/\b(should i|what (do|should) i (do|file)|next step)\b/i.test(text)) return "take_action";
  if (/\b(what is|define|explain)\b/i.test(text)) return "general_legal";
  return "procedural";
}

/**
 * Semantic interpreter — emits recommendations only.
 * ConversationRouter makes the binding pipeline decision.
 */
export function interpretIntent(input: ConversationMessageInput): IntentInterpretation {
  const contract = buildQuestionContract(input);
  const text = [input.message, input.goal].filter(Boolean).join("\n");
  const primary = detectIntent(text, contract.decision_target);
  const domain = detectDomain(text);

  let recommended_pipeline: PipelineId = contract.requires_case_development ? "case" : "assistant";
  let recommended_response_mode: ResponseMode = "answer_then_targeted_questions";
  let routing_confidence = 0.82;

  if (primary === "comprehensive_case_review") {
    recommended_pipeline = "case";
    recommended_response_mode = "initiate_case";
    routing_confidence = 0.94;
  } else if (primary === "document_interpretation") {
    recommended_pipeline = "assistant";
    recommended_response_mode = input.documentCount || text.length > 40 ? "answer" : "request_document";
    routing_confidence = 0.9;
  } else if (primary === "general_legal" || primary === "procedural") {
    recommended_pipeline = "assistant";
    recommended_response_mode = "answer";
    routing_confidence = 0.88;
  } else if (primary === "information_only") {
    recommended_pipeline = "assistant";
    recommended_response_mode = "answer_then_targeted_questions";
    routing_confidence = 0.75;
  } else if (primary === "personal_eligibility" || primary === "strategy_comparison") {
    recommended_pipeline = "assistant";
    recommended_response_mode = "answer_then_targeted_questions";
    routing_confidence = 0.86;
  }

  // Upload alone never bumps to case — only the ask does.
  if ((input.documentCount ?? 0) > 0 && !contract.requires_case_development) {
    recommended_pipeline = "assistant";
    routing_confidence = Math.max(routing_confidence, 0.88);
  }

  return {
    primary_intent: primary,
    domain,
    question: contract.interpreted_question || contract.explicit_question || text.slice(0, 200),
    recommended_pipeline,
    recommended_response_mode,
    routing_confidence,
    can_answer_partially_now: recommended_response_mode !== "request_document",
    requires_personalized_analysis: primary === "personal_eligibility" || primary === "comprehensive_case_review",
  };
}
