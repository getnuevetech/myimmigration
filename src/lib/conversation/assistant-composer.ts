import type { ConversationIntelligence } from "./types";

/**
 * Deterministic assistant composer — used as the answer-first scaffold and
 * fallback when models are unavailable. Domain-specific templates stay thin.
 */
export function composeAssistantReply(intel: ConversationIntelligence, rawMessage: string): string {
  const parts: string[] = [];
  const target = intel.question_contract.decision_target;

  if (intel.strategy.mode === "clarify_first") {
    const ask = intel.need_to_know.find((item) => item.tier === "critical_now");
    parts.push(
      intel.answerability.clarify_first_reason ||
        "I need one clarifying detail before I can give a reliable answer.",
    );
    if (ask) parts.push(ask.question);
    return parts.join("\n\n");
  }

  if (intel.strategy.mode === "request_document") {
    return "Please upload or paste the notice (or tell me the form/notice number at the top). I can explain what it means once I can identify it — I do not need a full case file first.";
  }

  if (intel.strategy.mode === "initiate_case") {
    return "This sounds like you want a full case review — filings, risks, and a concrete next-action plan. I will open a case analysis for that broader work.";
  }

  // BRANCH_BEFORE_CLARIFY / answer-first body
  if (target === "petition_eligibility_overview") {
    parts.push(
      "Yes. A U.S.-citizen spouse can generally file Form I-130 for their spouse. That starts the family petition.",
    );
    parts.push(
      "Whether you can obtain a green card *inside* the United States still depends on additional facts — especially how you entered the country.",
    );
  } else if (target === "explain_document_or_notice") {
    if (/\bi-?862\b|notice to appear|\bnta\b/i.test(rawMessage)) {
      parts.push(
        "Form I-862 is a Notice to Appear (NTA). In general, it means the Department of Homeland Security is initiating removal (deportation) proceedings in immigration court.",
      );
      parts.push(
        "It is a charging document, not a final removal order by itself. Deadlines, hearing dates, and the allegations listed on the NTA control what happens next.",
      );
    } else if (/\bcp\s?503\b/i.test(rawMessage)) {
      parts.push(
        "An IRS CP503 is a collection reminder notice. It generally means the IRS believes you still owe a balance and is continuing collection contact — it is not the final levy notice by itself.",
      );
    } else {
      parts.push(
        "I can explain the notice you referenced. Based on what you shared, here is the plain-English meaning and what usually comes next.",
      );
    }
  } else if (target === "document_checklist") {
    parts.push(
      "For a marriage-based green card, people typically gather: proof of the U.S. citizen spouse’s status, a marriage certificate, identity documents, jointly held evidence of a bona fide marriage, and financial sponsorship papers (such as an I-864 package). Exact lists vary by path (adjustment vs consular).",
    );
    parts.push("You do not need to upload those documents for me to explain the checklist.");
  } else if (target === "interpret_situation_offer_next_step") {
    parts.push(
      "Thanks for sharing that background. I can help in different ways — for example outlining possible pathways, explaining a notice, or running a full case review.",
    );
  } else if (intel.strategy.branches.length) {
    parts.push("There are a few major pathways that usually matter for your question:");
  } else {
    parts.push(
      `Here is a direct answer to: ${intel.question_contract.interpreted_question || intel.question_contract.explicit_question}`,
    );
  }

  if (intel.strategy.branch_before_clarify && intel.strategy.branches.length) {
    for (const branch of intel.strategy.branches) {
      parts.push(`**${branch.condition}:** ${branch.explanation}`);
    }
  }

  if (intel.strategy.mode === "answer_then_targeted_questions" && intel.strategy.ask_now[0]) {
    const ask = intel.strategy.ask_now[0];
    parts.push(`To determine which pathway applies to you: ${ask.question}`);
    parts.push(`_(Why this matters: ${ask.reason})_`);
  }

  parts.push(
    "This is general information based on official frameworks, not legal advice. A licensed professional should review high-stakes decisions.",
  );

  return parts.join("\n\n");
}
