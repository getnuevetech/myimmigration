import type { AnswerBranch, NeedToKnowItem, QuestionContract } from "./types";

/**
 * BRANCH_BEFORE_CLARIFY: when a material unknown creates a manageable set of
 * legally meaningful branches, explain them before asking.
 */
export function analyzeBranches(opts: {
  contract: QuestionContract;
  message: string;
  askNow: NeedToKnowItem[];
}): { branch_before_clarify: boolean; branches: AnswerBranch[] } {
  const { contract, message, askNow } = opts;
  const text = message.toLowerCase();
  const entryUnknown = askNow.some((item) => item.branches_affected.includes("adjustment_of_status"));

  if (
    (contract.decision_target === "identify_available_pathways" ||
      contract.decision_target === "petition_eligibility_overview") &&
    entryUnknown &&
    !/\b(parole|paroled|inspected|admitted|without inspection|ewi)\b/i.test(text)
  ) {
    return {
      branch_before_clarify: true,
      branches: [
        {
          id: "adjustment_of_status",
          condition: "If you were inspected, admitted, or paroled into the United States",
          explanation:
            "A U.S.-citizen spouse can generally file Form I-130, and you may be able to pursue adjustment of status (Form I-485) inside the U.S. if you are otherwise eligible.",
        },
        {
          id: "consular_processing",
          condition: "If you entered without inspection",
          explanation:
            "Your U.S.-citizen spouse can still usually file Form I-130, but getting a green card often involves consular processing abroad and may raise unlawful-presence / waiver issues.",
        },
      ],
    };
  }

  if (contract.decision_target === "petition_eligibility_overview" && /\busc|u\.?s\.?\s*citizen|citizen wife|citizen husband|citizen spouse\b/i.test(text)) {
    return {
      branch_before_clarify: true,
      branches: [
        {
          id: "i130_filing",
          condition: "Petition filing",
          explanation:
            "Yes — a U.S.-citizen spouse can generally file Form I-130 for their spouse. That starts the family petition process.",
        },
        {
          id: "green_card_path",
          condition: "Getting the green card",
          explanation:
            "Whether you can finish inside the U.S. (adjustment) or must use consular processing depends mainly on how you entered and other eligibility facts.",
        },
      ],
    };
  }

  return { branch_before_clarify: false, branches: [] };
}
