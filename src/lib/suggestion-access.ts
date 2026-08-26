import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";

export type SuggestionAudience = "guest" | "free" | "plus" | "pro";

export type SuggestionEntitlement = {
  audience: SuggestionAudience;
  maxPathSteps: number | null;
  maxClarifyAnswers: number | null;
  personalized: boolean;
  consultantReferral: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
  showConsultantCta: boolean;
};

export type SuggestionUsage = {
  used: number;
  remaining: number | null;
  blocked: boolean;
  blockReason: string;
};

export type SuggestionConsultantPreview = {
  name: string;
  credentialLabel: string;
} | null;

export type SuggestionChatAccess = {
  audience: SuggestionAudience;
  remaining: number | null;
  limit: number | null;
  blocked: boolean;
  blockReason: string;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
  showConsultantCta: boolean;
  consultantName?: string | null;
  maxPathSteps: number | null;
  personalized: boolean;
  consultantReferral: boolean;
};

export const DEFAULT_GUEST_SUGGESTIONS = {
  maxPathSteps: 1,
  maxClarifyAnswers: 0,
};

export const DEFAULT_FREE_SUGGESTIONS = {
  maxPathSteps: 1,
  maxClarifyAnswers: 3,
};

export function resolveSuggestionEntitlement(input: {
  isGuest: boolean;
  planKey?: string;
  personalized?: boolean;
  consultantReferral?: boolean;
  guestMaxPathSteps?: number;
  freeMaxPathSteps?: number;
  freeMaxClarifyAnswers?: number;
}): SuggestionEntitlement {
  if (input.isGuest) {
    return {
      audience: "guest",
      maxPathSteps: input.guestMaxPathSteps ?? DEFAULT_GUEST_SUGGESTIONS.maxPathSteps,
      maxClarifyAnswers: DEFAULT_GUEST_SUGGESTIONS.maxClarifyAnswers,
      personalized: false,
      consultantReferral: false,
      showRegisterCta: true,
      showUpgradeCta: false,
      showConsultantCta: true,
    };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: SuggestionAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  const personalized = Boolean(input.personalized);
  const consultantReferral = Boolean(input.consultantReferral);
  return {
    audience,
    maxPathSteps: personalized ? null : (input.freeMaxPathSteps ?? DEFAULT_FREE_SUGGESTIONS.maxPathSteps),
    maxClarifyAnswers: personalized ? null : (input.freeMaxClarifyAnswers ?? DEFAULT_FREE_SUGGESTIONS.maxClarifyAnswers),
    personalized,
    consultantReferral,
    showRegisterCta: false,
    showUpgradeCta: audience !== "pro",
    showConsultantCta: true,
  };
}

export function suggestionUsageFromCount(
  used: number,
  entitlement: SuggestionEntitlement,
  input: FiledSurfaceInput = {},
): SuggestionUsage {
  if (entitlement.maxClarifyAnswers === null) {
    return { used, remaining: null, blocked: false, blockReason: "" };
  }
  const remaining = Math.max(0, entitlement.maxClarifyAnswers - used);
  if (remaining <= 0) {
    const noun = isFiledCaseSurface(input) ? "case" : "situation";
    const blockReason = entitlement.audience === "guest"
      ? "Create a free account to keep answering official follow-ups. Paid plans keep the full suggested next steps, and Pro can match you with a licensed attorney or accredited representative on ImmigrationOnMe."
      : `You have used this ${noun}'s follow-up questions on the Free plan. Upgrade to Plus for the full suggested path from official material, or Pro to add a matched immigration lawyer or accredited representative.`;
    return { used, remaining: 0, blocked: true, blockReason };
  }
  return { used, remaining, blocked: false, blockReason: "" };
}

export function toSuggestionChatAccess(
  entitlement: SuggestionEntitlement,
  usage: SuggestionUsage,
  consultantName?: string | null,
): SuggestionChatAccess {
  return {
    audience: entitlement.audience,
    remaining: usage.remaining,
    limit: entitlement.maxClarifyAnswers,
    blocked: usage.blocked,
    blockReason: usage.blockReason,
    showRegisterCta: entitlement.showRegisterCta,
    showUpgradeCta: entitlement.showUpgradeCta,
    showConsultantCta: entitlement.showConsultantCta,
    consultantName: consultantName ?? null,
    maxPathSteps: entitlement.maxPathSteps,
    personalized: entitlement.personalized,
    consultantReferral: entitlement.consultantReferral,
  };
}

export function limitSuggestionItems<T>(items: T[], max: number | null): { visible: T[]; hidden: number } {
  if (max == null || items.length <= max) return { visible: items, hidden: 0 };
  const keep = Math.max(1, max);
  return { visible: items.slice(0, keep), hidden: items.length - keep };
}

export function suggestionConsultantCopy(
  entitlement: SuggestionEntitlement,
  consultant: SuggestionConsultantPreview = null,
  professionalReviewRecommended = false,
  input: FiledSurfaceInput = {},
): string {
  const kind = isFiledCaseSurface(input) ? "case" : "situation";
  if (entitlement.consultantReferral && consultant) {
    const who = [consultant.name, consultant.credentialLabel].filter(Boolean).join(", ");
    return professionalReviewRecommended
      ? `Professional review is recommended for this matter. A licensed professional on ImmigrationOnMe who works this kind of ${kind}: ${who}. Request a match — nothing is shared until you approve.`
      : `A licensed professional on ImmigrationOnMe who works this kind of matter: ${who}. Open Consultants to request a match — nothing is shared until you approve.`;
  }
  if (entitlement.consultantReferral) {
    return professionalReviewRecommended
      ? "Professional review is recommended. Pro can match you with a licensed immigration attorney or accredited representative on this platform — nothing is shared until you approve."
      : "Pro includes matching with a licensed immigration attorney or accredited representative on this platform. Open Consultants to request a match when one is available — nothing is shared until you approve.";
  }
  if (entitlement.audience === "guest") {
    return "Create a free account to keep this suggested next step. Paid plans unlock the full official path, and Pro can match you with a licensed immigration attorney or accredited representative on ImmigrationOnMe.";
  }
  if (professionalReviewRecommended) {
    return "Professional review is recommended. Upgrade to Pro to get a matched licensed attorney or accredited representative on ImmigrationOnMe — nothing is shared until you approve.";
  }
  if (entitlement.audience === "free") {
    return "This is the next official step on the Free plan. Plus keeps the full suggested path from matching USCIS/DOJ material. Pro can match you with a licensed attorney or accredited representative — nothing is shared until you approve.";
  }
  return "A licensed immigration attorney or accredited representative on this platform can go deeper than these suggested steps. Upgrade to Pro to get a matched professional. Nothing is shared until you approve.";
}
