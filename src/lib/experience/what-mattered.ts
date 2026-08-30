/**
 * Phase −1.9 L2 — what-mattered partitioning.
 * Separates decision-changing facts from discarded / not-needed-yet fact keys.
 * Keys only — never free-text PII.
 */

import type { NeedToKnowItem, QuestionContract } from "../conversation/types";

/** Fact keys that must not drive early pathway asks (negative-learning aligned). */
export const DISCARDED_EARLY_PATHWAY_FACTS = [
  "medical_exam",
  "priority_date",
  "financial_sponsorship_details",
  "passport_upload",
  "marriage_evidence_checklist",
  "exact_entry_date",
  "employment_history",
] as const;

export type WhatMatteredPartition = {
  facts_considered: string[];
  decision_changing_facts: string[];
  /** Explicit alias of suppressed / not-yet keys for L2 consumers. */
  facts_discarded: string[];
  facts_not_needed_yet: string[];
};

/**
 * Detect situation feature keys from narrative (institutional labels, not PII).
 */
export function extractSituationFeatures(message: string): string[] {
  const text = String(message ?? "").toLowerCase();
  const features: string[] = [];

  if (/\b(wife|husband|spouse).{0,40}\b(us\s*citizen|u\.?s\.?\s*citizen|american citizen)|(?:us\s*citizen|u\.?s\.?\s*citizen).{0,40}\b(wife|husband|spouse)\b/.test(text)) {
    features.push("us_citizen_spouse");
  } else if (/\b(us\s*citizen|u\.?s\.?\s*citizen|american citizen)\b/.test(text) && /\b(wife|husband|spouse|married)\b/.test(text)) {
    features.push("us_citizen_spouse");
  }

  if (/\b(daughter|son|child|kids?).{0,40}\b(born in the us|born in the u\.?s|usc|us citizen)|(?:born in the us|born in the u\.?s).{0,40}\b(daughter|son|child)\b/.test(text)) {
    features.push("us_born_child");
  }

  if (/\b(border|mexico|cbp|border patrol|crossed|through the border)\b/.test(text)) {
    features.push("border_entry");
  }

  if (/\b(parole|paroled|inspected|admitted|i-?94|without inspection|ewi|entered illegally)\b/.test(text)) {
    features.push("manner_of_entry_known");
  }

  if (/\b(\d+)\s*(years?|yrs?).{0,20}\b(us|u\.?s\.?|united states|america)|living in the (us|u\.?s)/.test(text)) {
    features.push("years_us_presence");
  }

  if (/\b(yet to file|not filed|never filed|no (prior )?filing|haven't filed|have not filed|am yet to file)\b/.test(text)) {
    features.push("no_prior_filing");
  }

  if (/\b(removal|deport|nta|i-?862|immigration court|proceedings)\b/.test(text)) {
    features.push("removal_signal");
  }

  if (/\b(what are my options|options|pathways|what can i (do|file))\b/.test(text)) {
    features.push("asks_for_options");
  }

  return unique(features);
}

function clarificationFactKey(question: string): string {
  const q = question.toLowerCase();
  if (/inspect|parole|admitted|without inspection|border|entry/.test(q)) return "manner_of_entry";
  if (/removal|nta|i-?862|proceedings/.test(q)) return "removal_proceedings";
  if (/form|notice number/.test(q)) return "notice_identity";
  if (/medical|i-?693/.test(q)) return "medical_exam";
  if (/priority date/.test(q)) return "priority_date";
  if (/passport/.test(q)) return "passport_upload";
  if (/i-?864|affidavit|sponsor/.test(q)) return "financial_sponsorship_details";
  if (/employment|job history/.test(q)) return "employment_history";
  if (/date of entry|exact date/.test(q)) return "exact_entry_date";
  return "targeted_clarification";
}

function deferredFactKeys(items: NeedToKnowItem[]): string[] {
  return unique(
    items
      .filter((item) => !(item.tier === "critical_now" && item.changes_branch))
      .map((item) => clarificationFactKey(item.question)),
  );
}

/**
 * Partition considered / decision-changing / discarded facts for a turn.
 */
export function partitionWhatMattered(opts: {
  message: string;
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
  needToKnow?: NeedToKnowItem[];
  pathways?: string[];
}): WhatMatteredPartition {
  const features = extractSituationFeatures(opts.message);
  const askKeys = opts.askNow.map((a) => clarificationFactKey(a.question));
  const changingFromAsk = opts.askNow.filter((a) => a.changes_branch).map((a) => clarificationFactKey(a.question));

  // Known manner of entry already changes pathway branch without asking.
  const changingFromKnown: string[] = [];
  if (features.includes("manner_of_entry_known")) {
    changingFromKnown.push("manner_of_entry");
  }
  if (features.includes("removal_signal")) {
    changingFromKnown.push("removal_proceedings");
  }

  const decision_changing_facts = unique([...changingFromAsk, ...changingFromKnown]);

  const pathwayEarly =
    opts.contract.decision_target === "identify_available_pathways" ||
    opts.contract.decision_target === "petition_eligibility_overview" ||
    opts.contract.decision_target === "identify_possible_pathways";

  const discardedDefaults = pathwayEarly ? [...DISCARDED_EARLY_PATHWAY_FACTS] : ["medical_exam"];
  const discardedFromNeed = deferredFactKeys(opts.needToKnow ?? []);
  // Never mark a decision-changing key as discarded.
  const facts_discarded = unique([...discardedDefaults, ...discardedFromNeed]).filter(
    (k) => !decision_changing_facts.includes(k),
  );

  const facts_considered = unique([
    ...features,
    ...askKeys,
    ...facts_discarded,
    ...(opts.pathways ?? []).map((p) => `pathway:${p}`),
  ]);

  return {
    facts_considered,
    decision_changing_facts,
    facts_discarded,
    facts_not_needed_yet: facts_discarded,
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
