import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";
import { matchingFormNumber } from "./goal-forms";
import { neededDocumentsFromRanked, rankMatchingDocuments } from "./goal-documents";

export const FILED_CORE_READINESS_KEYS = ["receipt_number", "form_type", "notice_type"] as const;
export const MATCHING_FORM_SIGNAL = "matching_form";

export type ReadinessCopy = {
  overallLabel: string;
  overallHint: string;
  availableLabel: string;
  processedLabel: string;
  actionLabel: string;
  splitHint: string;
  dashboardStatLabel: string;
  dashboardStatHint: string;
  reportOverallLabel: string;
  closingReached: (score: number) => string;
};

export type ReadinessPolicy = {
  filed: boolean;
  documentsExpected: number;
  coreKeys: string[];
  haveKinds: string[];
  penalizeAllUnknowns: boolean;
};

export type ReadinessMatchInput = FiledSurfaceInput & {
  documentsExpected?: number;
  haveKinds?: string[];
};

const OPTIONS_COPY: ReadinessCopy = {
  overallLabel: "Options progress",
  overallHint:
    "Computed from matching documents you uploaded, official material for this goal, and unanswered contradictions — not from a receipt you do not have.",
  availableLabel: "Matching evidence provided",
  processedLabel: "Matching evidence processed",
  actionLabel: "Next-step readiness",
  splitHint:
    "Provided means identity, relationship, or other matching records are uploaded. Processed means the platform read them. Next-step readiness means official material can support the next matching action — a USCIS receipt is not required.",
  dashboardStatLabel: "Options progress",
  dashboardStatHint: "matching evidence + official material — no receipt required",
  reportOverallLabel: "Options progress",
  closingReached: (score) => `Options progress reached ${score}%.`,
};

const FILED_COPY: ReadinessCopy = {
  overallLabel: "Case readiness",
  overallHint:
    "Computed from documents obtained, facts verified, USCIS source confirmation, and unresolved contradictions.",
  availableLabel: "Evidence provided",
  processedLabel: "Evidence processed",
  actionLabel: "Action readiness",
  splitHint:
    "Provided means records are uploaded. Processed means the platform read them. Action readiness means the compiled evidence is strong enough to support next steps.",
  dashboardStatLabel: "Case readiness",
  dashboardStatHint: "documents + verified facts − open questions",
  reportOverallLabel: "Readiness",
  closingReached: (score) => `Case readiness reached ${score}%.`,
};

export function resolveReadinessCopy(input: ReadinessMatchInput = {}): ReadinessCopy {
  return isFiledCaseSurface(input) ? FILED_COPY : OPTIONS_COPY;
}

export function resolveReadinessPolicy(input: ReadinessMatchInput = {}): ReadinessPolicy {
  const filed = isFiledCaseSurface(input);
  const settingExpected = Math.max(1, input.documentsExpected ?? 3);
  const haveKinds = (input.haveKinds ?? []).map((kind) => kind.trim()).filter(Boolean);
  if (filed) {
    return {
      filed: true,
      documentsExpected: settingExpected,
      coreKeys: [...FILED_CORE_READINESS_KEYS],
      haveKinds,
      penalizeAllUnknowns: true,
    };
  }
  const needed = neededDocumentsFromRanked(rankMatchingDocuments(input))
    .map((item) => item.kind)
    .slice(0, 2);
  const formNumber = matchingFormNumber(input);
  const coreKeys = [
    ...(formNumber ? [MATCHING_FORM_SIGNAL] : []),
    ...needed,
  ];
  return {
    filed: false,
    documentsExpected: Math.max(needed.length, 1),
    coreKeys: coreKeys.length ? coreKeys : ["identity"],
    haveKinds,
    penalizeAllUnknowns: false,
  };
}

export function presentReadinessSignals(policy: ReadinessPolicy, factKeys: Iterable<string>): string[] {
  const facts = new Set(factKeys);
  const kinds = new Set(policy.haveKinds);
  return policy.coreKeys.filter((key) => {
    if (key === MATCHING_FORM_SIGNAL) return true;
    return facts.has(key) || kinds.has(key);
  });
}

export function unknownPenaltyCount(
  unknowns: { key: string }[],
  penalizeAllUnknowns: boolean,
): number {
  if (penalizeAllUnknowns) return unknowns.length;
  return unknowns.filter((item) => (FILED_CORE_READINESS_KEYS as readonly string[]).includes(item.key)).length;
}
