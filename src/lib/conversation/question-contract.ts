import type { ConversationMessageInput, QuestionContract } from "./types";
import { emptyQuestionContract } from "./types";

const EXPLICIT_Q_RE =
  /\b(what|how|can|could|should|do i|does|is it|am i|are there|which|when|where|why|explain|tell me|mean)\b/i;
const OPTIONS_RE = /\b(options?|pathways?|paths?|what can i (do|file)|available)\b/i;
const FILE_FOR_ME_RE = /\b(file|petition|sponsor)\b.*\b(for me|on my behalf)\b|\bcan (my|a) .+\b(file|petition|sponsor)\b/i;
const NOTICE_MEANING_RE =
  /\b(what (does|is)|mean|explain)\b.*\b(i-?\d{3}|nta|notice to appear|rfe|noid|cp\d+|irs)\b|\b(i-?862|i-?797|notice to appear)\b.*\b(what|mean)\b/i;
const DOCS_NEEDED_RE = /\b(what documents?|which documents?|documents? (do i|needed|required))\b/i;
const COMPREHENSIVE_RE =
  /\b(review my entire|entire (immigration|tax) situation|tell me what I should file|build a strategy|complete (case|strategy)|comprehensive (review|analysis)|resolve all my)\b/i;
const STATUS_RE = /\b(status|where is my case|case status|receipt number|biometrics)\b/i;
const RISK_RE = /\b(risk|deport|removal|arrest|ice|safe to)\b/i;

function firstQuestionSentence(text: string): string {
  const q = text.match(/[^.!?]*\?/g)?.map((s) => s.trim()).find(Boolean);
  if (q) return q;
  if (EXPLICIT_Q_RE.test(text) || OPTIONS_RE.test(text)) return text.trim().slice(0, 280);
  return "";
}

/**
 * Build the persistent Question Contract for this turn.
 * Downstream components may only ask for facts that advance decision_target.
 * When priorContract is set, follow-ups refine it instead of replacing the decision target.
 */
export function buildQuestionContract(input: ConversationMessageInput): QuestionContract {
  const message = String(input.message ?? "").trim();
  const goal = String(input.goal ?? "").trim();
  const combined = [message, goal].filter(Boolean).join("\n");
  const explicit = firstQuestionSentence(combined) || (goal.match(/\?/) ? goal : "");

  const base = emptyQuestionContract();
  if (!combined) return mergeWithPrior(input.priorContract, base);

  let next: QuestionContract;

  if (COMPREHENSIVE_RE.test(combined) || input.forceCase) {
    next = {
      explicit_question: explicit || "Review my full situation and recommend filings.",
      interpreted_question: "Provide a comprehensive case strategy and filing recommendations.",
      decision_target: "comprehensive_case_strategy",
      current_scope: "full_case_development",
      user_requested_action: true,
      requires_case_development: true,
    };
  } else if (NOTICE_MEANING_RE.test(combined) || (input.documentCount && /\b(what|mean|explain|this)\b/i.test(combined))) {
    next = {
      explicit_question: explicit || "What does this notice/document mean?",
      interpreted_question: "Explain the meaning and immediate implications of the referenced notice or document.",
      decision_target: "explain_document_or_notice",
      current_scope: "document_interpretation",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (FILE_FOR_ME_RE.test(combined)) {
    next = {
      explicit_question: explicit || "Can my relative file for me?",
      interpreted_question: "Whether a qualifying relative can file a family petition, and what still controls green-card timing/path.",
      decision_target: "petition_eligibility_overview",
      current_scope: "pre-filing family petition",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (DOCS_NEEDED_RE.test(combined)) {
    next = {
      explicit_question: explicit || "What documents do I need?",
      interpreted_question: "List typical supporting documents for the described filing goal.",
      decision_target: "document_checklist",
      current_scope: "document_guidance",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (OPTIONS_RE.test(combined) || (!explicit && message.length >= 40 && /\b(wife|husband|spouse|married|entered|border|usc|citizen)\b/i.test(combined))) {
    next = {
      explicit_question: explicit || "What are my options?",
      interpreted_question:
        "Identify immigration pathways that may be available based on the facts stated, with conditions that change the path.",
      decision_target: "identify_available_pathways",
      current_scope: "pre-filing immigration options",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (STATUS_RE.test(combined)) {
    next = {
      explicit_question: explicit || "What is my status / case update?",
      interpreted_question: "Explain how to read status for the described filing or notice.",
      decision_target: "status_guidance",
      current_scope: "status_update",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (RISK_RE.test(combined)) {
    next = {
      explicit_question: explicit || "What are the risks?",
      interpreted_question: "Explain material risks implied by the facts, without inventing filings.",
      decision_target: "risk_overview",
      current_scope: "risk_guidance",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else if (explicit || EXPLICIT_Q_RE.test(combined)) {
    next = {
      explicit_question: explicit || combined.slice(0, 200),
      interpreted_question: explicit || combined.slice(0, 280),
      decision_target: "answer_user_question",
      current_scope: "general_guidance",
      user_requested_action: false,
      requires_case_development: false,
    };
  } else {
    next = {
      explicit_question: "",
      interpreted_question: "User provided situation facts without an explicit question; offer useful framing and ask what they want next.",
      decision_target: "interpret_situation_offer_next_step",
      current_scope: "information_only",
      user_requested_action: false,
      requires_case_development: false,
    };
  }

  return mergeWithPrior(input.priorContract, next);
}

/** Continuity: keep prior decision_target unless the user clearly changes topic or requests case development. */
export function mergeWithPrior(prior: QuestionContract | null | undefined, next: QuestionContract): QuestionContract {
  if (!prior?.decision_target) return next;
  if (next.requires_case_development || next.decision_target === "comprehensive_case_strategy") return next;
  if (next.decision_target === prior.decision_target) {
    return {
      ...prior,
      ...next,
      decision_target: prior.decision_target,
      current_scope: prior.current_scope || next.current_scope,
      interpreted_question: next.interpreted_question || prior.interpreted_question,
      explicit_question: next.explicit_question || prior.explicit_question,
    };
  }
  // Short follow-up / answer to a critical ask — keep prior target.
  const looksLikeFollowUp =
    !next.explicit_question ||
    next.decision_target === "interpret_situation_offer_next_step" ||
    (next.decision_target === "answer_user_question" && next.explicit_question.length < 80);
  if (looksLikeFollowUp && !NOTICE_MEANING_RE.test(next.explicit_question) && !COMPREHENSIVE_RE.test(next.explicit_question)) {
    return {
      ...prior,
      explicit_question: next.explicit_question || prior.explicit_question,
      interpreted_question: prior.interpreted_question,
      user_requested_action: prior.user_requested_action,
      requires_case_development: false,
    };
  }
  return next;
}

export function helpsDecisionTarget(factKey: string, contract: QuestionContract): boolean {
  const key = factKey.toLowerCase();
  const target = contract.decision_target;
  if (target === "identify_available_pathways") {
    return /entry|parole|admission|ewi|inspection|removal|nta|proceedings|spouse|citizen|marriage/.test(key);
  }
  if (target === "explain_document_or_notice") {
    return /notice|form|deadline|charges|allegations|receipt|document/.test(key);
  }
  if (target === "petition_eligibility_overview") {
    return /spouse|citizen|relationship|entry|admission|parole|ewi/.test(key);
  }
  if (target === "document_checklist") {
    return /document|evidence|checklist|form/.test(key);
  }
  if (target === "comprehensive_case_strategy") return true;
  return /entry|status|notice|deadline|form|spouse|removal/.test(key);
}
