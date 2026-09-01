import { helpsDecisionTarget } from "./question-contract";
import type { Answerability, NeedToKnowItem, QuestionContract } from "./types";
import { narrativeHasUscSpouse } from "@/lib/situation-intelligence";

/**
 * Need-to-Know engine with impact requirement.
 * Only items with changes_branch=true and tier critical_now may be asked now.
 *
 * Entry-manner AOS vs consular asks require a family (USC/LPR spouse) basis —
 * otherwise the question assumes a pathway the customer never described.
 */
export function buildNeedToKnow(opts: {
  contract: QuestionContract;
  message: string;
  answerability: Answerability;
}): NeedToKnowItem[] {
  const { contract, message } = opts;
  const text = message.toLowerCase();
  const items: NeedToKnowItem[] = [];
  const hasFamilySpouse = narrativeHasUscSpouse(message);

  const knownEntry =
    /\b(parole|paroled|inspected|admitted|i-?94|without inspection|ewi|entered illegally|crossed)\b/i.test(text);
  const knownRemoval = /\b(removal|deport|nta|i-?862|immigration court|proceedings)\b/i.test(text);

  if (contract.decision_target === "identify_available_pathways" || contract.decision_target === "petition_eligibility_overview") {
    if (hasFamilySpouse && !knownEntry && helpsDecisionTarget("entry_manner", contract)) {
      items.push({
        question:
          "When you entered, were you inspected by Border Patrol/CBP and released (or paroled/admitted), or did you enter without inspection?",
        tier: "critical_now",
        reason: "Determines whether adjustment of status inside the U.S. may be available versus consular processing.",
        changes_branch: true,
        branches_affected: ["adjustment_of_status", "consular_processing"],
      });
    }
    if (!knownRemoval && helpsDecisionTarget("removal_proceedings", contract)) {
      items.push({
        question: "Have you ever been in removal proceedings or received a Notice to Appear (I-862)?",
        tier: "soon",
        reason: "Proceedings can change which agency controls your case and which options are realistic.",
        changes_branch: true,
        branches_affected: ["immigration_court", "affirmative_filing"],
      });
    }
    items.push({
      question: "What is your exact date of entry?",
      tier: "later",
      reason: "Useful for timeline precision but does not by itself choose the pathway branch.",
      changes_branch: false,
      branches_affected: [],
    });
    items.push({
      question: "What is your current employment history?",
      tier: "not_yet",
      reason: "Not required to explain current pathway options.",
      changes_branch: false,
      branches_affected: [],
    });
  }

  if (contract.decision_target === "explain_document_or_notice" && !/\b(i-?\d{3}|cp\d+|nta)\b/i.test(text)) {
    items.push({
      question: "What is the form or notice number printed at the top (for example I-862 or CP503)?",
      tier: "critical_now",
      reason: "Identifies which official notice is being explained.",
      changes_branch: true,
      branches_affected: ["notice_identity"],
    });
  }

  if (contract.decision_target === "interpret_situation_offer_next_step") {
    items.push({
      question:
        "What do you want help with most right now — understanding your options, explaining a notice you received, or tracking something already filed with the government?",
      tier: "critical_now",
      reason: "Sets the decision target when the user has not asked a question. Never asks the customer to pick an internal pipeline.",
      changes_branch: true,
      branches_affected: ["situation_options", "notice_explain", "existing_matter"],
    });
  }

  return items;
}

/** Composer may only surface these in the current turn. */
export function askableNow(items: NeedToKnowItem[]): NeedToKnowItem[] {
  return items.filter((item) => item.tier === "critical_now" && item.changes_branch === true).slice(0, 1);
}

export function deferrable(items: NeedToKnowItem[]): NeedToKnowItem[] {
  return items.filter((item) => !(item.tier === "critical_now" && item.changes_branch));
}
