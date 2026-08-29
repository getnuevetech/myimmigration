import type { AnswerBranch, ConversationIntelligence } from "./types";

export type AssistantViewSection =
  | { type: "paragraph"; text: string }
  | { type: "branches"; intro: string; branches: AnswerBranch[] }
  | { type: "ask"; question: string; reason: string }
  | { type: "disclaimer"; text: string };

const DISCLAIMER =
  "This is general information based on official frameworks, not legal advice. A licensed professional should review high-stakes decisions.";

/**
 * Structured assistant view for Pipeline A UI.
 * Domain-specific templates stay thin; layout owns presentation.
 */
export function composeAssistantView(
  intel: ConversationIntelligence,
  rawMessage: string,
): AssistantViewSection[] {
  const sections: AssistantViewSection[] = [];
  const target = intel.question_contract.decision_target;

  if (intel.strategy.mode === "clarify_first") {
    const ask = intel.need_to_know.find((item) => item.tier === "critical_now");
    sections.push({
      type: "paragraph",
      text:
        intel.answerability.clarify_first_reason ||
        "I need one clarifying detail before I can give a reliable answer.",
    });
    if (ask) sections.push({ type: "ask", question: ask.question, reason: ask.reason });
    return sections;
  }

  if (intel.strategy.mode === "request_document") {
    sections.push({
      type: "paragraph",
      text: "Please upload or paste the notice (or tell me the form/notice number at the top). I can explain what it means once I can identify it — I do not need a full case file first.",
    });
    return sections;
  }

  if (intel.strategy.mode === "initiate_case") {
    sections.push({
      type: "paragraph",
      text: "This sounds like you want a full case review — filings, risks, and a concrete next-action plan. I will open a case analysis for that broader work.",
    });
    return sections;
  }

  if (target === "petition_eligibility_overview") {
    sections.push({
      type: "paragraph",
      text: "Yes. A U.S.-citizen spouse can generally file Form I-130 for their spouse. That starts the family petition.",
    });
    sections.push({
      type: "paragraph",
      text: "Whether you can obtain a green card inside the United States still depends on additional facts — especially how you entered the country.",
    });
  } else if (target === "explain_document_or_notice") {
    if (/\bi-?862\b|notice to appear|\bnta\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "Form I-862 is a Notice to Appear (NTA). In general, it means the Department of Homeland Security is initiating removal (deportation) proceedings in immigration court.",
      });
      sections.push({
        type: "paragraph",
        text: "It is a charging document, not a final removal order by itself. Deadlines, hearing dates, and the allegations listed on the NTA control what happens next.",
      });
    } else if (/\bcp\s?503\b/i.test(rawMessage)) {
      sections.push({
        type: "paragraph",
        text: "An IRS CP503 is a collection reminder notice. It generally means the IRS believes you still owe a balance and is continuing collection contact — it is not the final levy notice by itself.",
      });
    } else {
      sections.push({
        type: "paragraph",
        text: "I can explain the notice you referenced. Based on what you shared, here is the plain-English meaning and what usually comes next.",
      });
    }
  } else if (target === "document_checklist") {
    sections.push({
      type: "paragraph",
      text: "For a marriage-based green card, people typically gather: proof of the U.S. citizen spouse’s status, a marriage certificate, identity documents, jointly held evidence of a bona fide marriage, and financial sponsorship papers (such as an I-864 package). Exact lists vary by path (adjustment vs consular).",
    });
    sections.push({
      type: "paragraph",
      text: "You do not need to upload those documents for me to explain the checklist.",
    });
  } else if (target === "interpret_situation_offer_next_step") {
    sections.push({
      type: "paragraph",
      text: "Thanks for sharing that background. I can help in different ways — for example outlining possible pathways, explaining a notice, or running a full case review.",
    });
  } else if (!(intel.strategy.branch_before_clarify && intel.strategy.branches.length)) {
    sections.push({
      type: "paragraph",
      text: `Here is a direct answer to: ${intel.question_contract.interpreted_question || intel.question_contract.explicit_question}`,
    });
  }

  if (intel.strategy.branch_before_clarify && intel.strategy.branches.length) {
    const intro =
      target === "identify_available_pathways" || intel.strategy.branches.length >= 2
        ? "Pathways that usually matter"
        : "What can apply";
    sections.push({ type: "branches", intro, branches: intel.strategy.branches });
  }

  if (intel.strategy.mode === "answer_then_targeted_questions" && intel.strategy.ask_now[0]) {
    const ask = intel.strategy.ask_now[0];
    sections.push({
      type: "ask",
      question: `To determine which pathway applies to you: ${ask.question}`,
      reason: ask.reason,
    });
  }

  sections.push({ type: "disclaimer", text: DISCLAIMER });
  return sections;
}

/** Plain-text / acceptance-test scaffold — no markdown markers. */
export function composeAssistantReply(intel: ConversationIntelligence, rawMessage: string): string {
  return composeAssistantView(intel, rawMessage)
    .map((section) => {
      if (section.type === "paragraph" || section.type === "disclaimer") return section.text;
      if (section.type === "ask") {
        return `${section.question}\n\nWhy this matters: ${section.reason}`;
      }
      return [
        section.intro + ":",
        ...section.branches.map((branch) => `${branch.condition}: ${branch.explanation}`),
      ].join("\n\n");
    })
    .join("\n\n");
}

/** Short customer-facing label for the active decision target. */
export function decisionFocusLabel(decisionTarget: string): string {
  switch (decisionTarget) {
    case "petition_eligibility_overview":
      return "Whether a relative can file for you";
    case "identify_available_pathways":
      return "Which pathways may be available";
    case "explain_document_or_notice":
      return "What this notice or document means";
    case "document_checklist":
      return "Documents typically needed";
    case "status_guidance":
      return "How to read your case status";
    case "risk_overview":
      return "Material risks in your situation";
    case "comprehensive_case_strategy":
      return "Full case review";
    case "interpret_situation_offer_next_step":
      return "What you want help with next";
    case "answer_user_question":
      return "Answering your question";
    default:
      return "Understanding your request";
  }
}
