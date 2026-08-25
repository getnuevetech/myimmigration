import "server-only";
import { db } from "./db";
import { getActivePlan, hasFeature } from "./access";
import { getNumberSetting } from "./settings";
import { FEATURE_KEYS } from "./constants";
import {
  resolveSuggestionEntitlement,
  suggestionUsageFromCount,
  toSuggestionChatAccess,
  type SuggestionChatAccess,
  type SuggestionConsultantPreview,
  type SuggestionEntitlement,
  type SuggestionUsage,
} from "./suggestion-access";

export type SuggestionAccess = {
  entitlement: SuggestionEntitlement;
  usage: SuggestionUsage;
  consultant: SuggestionConsultantPreview;
};

export async function countClarifyAnswers(caseId: string): Promise<number> {
  return db.caseClarifyMessage.count({
    where: { caseId, role: "user" },
  });
}

export async function loadSuggestionAccess(input: {
  userId?: string | null;
  caseId?: string | null;
}): Promise<SuggestionAccess> {
  const [guestMaxPathSteps, freeMaxPathSteps, freeMaxClarifyAnswers] = await Promise.all([
    getNumberSetting("suggestions.guest_max_steps", 1),
    getNumberSetting("suggestions.free_max_steps", 1),
    getNumberSetting("suggestions.free_max_clarify", 3),
  ]);
  if (!input.userId) {
    const entitlement = resolveSuggestionEntitlement({
      isGuest: true,
      guestMaxPathSteps,
    });
    return { entitlement, usage: suggestionUsageFromCount(0, entitlement), consultant: null };
  }
  const plan = await getActivePlan(input.userId);
  const [personalized, consultantReferral] = await Promise.all([
    hasFeature(input.userId, FEATURE_KEYS.SUGGESTIONS_PERSONALIZED),
    hasFeature(input.userId, FEATURE_KEYS.CONSULTANT_REFERRAL),
  ]);
  const entitlement = resolveSuggestionEntitlement({
    isGuest: false,
    planKey: plan?.key,
    personalized,
    consultantReferral,
    freeMaxPathSteps,
    freeMaxClarifyAnswers,
  });
  const used = input.caseId ? await countClarifyAnswers(input.caseId) : 0;
  return { entitlement, usage: suggestionUsageFromCount(used, entitlement), consultant: null };
}

export function toCaseSuggestionAccess(
  access: SuggestionAccess,
  consultantName?: string | null,
): SuggestionChatAccess {
  return toSuggestionChatAccess(access.entitlement, access.usage, consultantName);
}

export { toSuggestionChatAccess } from "./suggestion-access";
