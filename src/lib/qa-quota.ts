import "server-only";
import { db } from "./db";
import { getActivePlan, hasFeature, featureLimit } from "./access";
import { getNumberSetting } from "./settings";
import { FEATURE_KEYS } from "./constants";
import {
  qaUsageFromCount,
  resolveQaEntitlement,
  type QaConsultantPreview,
  type QaEntitlement,
  type QaUsage,
} from "./qa-access";

export type QaAccess = {
  entitlement: QaEntitlement;
  usage: QaUsage;
  consultant: QaConsultantPreview;
};

function monthStart(): Date {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export async function countQaQuestions(input: { userId?: string | null; guestSessionId?: string | null }): Promise<number> {
  if (input.userId) {
    return db.qaMessage.count({
      where: {
        role: "user",
        createdAt: { gte: monthStart() },
        thread: { userId: input.userId, kind: "qa", caseId: null },
      },
    });
  }
  if (input.guestSessionId) {
    return db.qaMessage.count({
      where: {
        role: "user",
        thread: { guestSessionId: input.guestSessionId, kind: "qa", caseId: null },
      },
    });
  }
  return 0;
}

export async function loadQaAccess(input: {
  userId?: string | null;
  guestSessionId?: string | null;
}): Promise<QaAccess> {
  const [
    guestQuestionLimit,
    guestMaxSentences,
    guestMaxExcerpts,
    guestMaxFollowUps,
    freeMaxSentences,
    freeMaxExcerpts,
    freeMaxFollowUps,
  ] = await Promise.all([
    getNumberSetting("qa.guest_question_limit", 1),
    getNumberSetting("qa.guest_max_sentences", 2),
    getNumberSetting("qa.guest_max_excerpts", 1),
    getNumberSetting("qa.guest_follow_ups", 1),
    getNumberSetting("qa.free_max_sentences", 3),
    getNumberSetting("qa.free_max_excerpts", 1),
    getNumberSetting("qa.free_follow_ups", 1),
  ]);
  if (!input.userId) {
    const entitlement = resolveQaEntitlement({
      isGuest: true,
      guestQuestionLimit,
      guestMaxSentences,
      guestMaxExcerpts,
      guestMaxFollowUps,
    });
    const used = await countQaQuestions({ guestSessionId: input.guestSessionId });
    return { entitlement, usage: qaUsageFromCount(used, entitlement), consultant: null };
  }
  const plan = await getActivePlan(input.userId);
  const [qaEnabled, qaQuestionLimit, personalized, consultantReferral] = await Promise.all([
    hasFeature(input.userId, FEATURE_KEYS.QA),
    featureLimit(input.userId, FEATURE_KEYS.QA),
    hasFeature(input.userId, FEATURE_KEYS.QA_PERSONALIZED),
    hasFeature(input.userId, FEATURE_KEYS.CONSULTANT_REFERRAL),
  ]);
  const entitlement = resolveQaEntitlement({
    isGuest: false,
    planKey: plan?.key,
    qaEnabled,
    qaQuestionLimit: qaEnabled ? qaQuestionLimit : 0,
    personalized,
    consultantReferral,
    freeMaxSentences,
    freeMaxExcerpts,
    freeMaxFollowUps,
  });
  const used = await countQaQuestions({ userId: input.userId });
  return { entitlement, usage: qaUsageFromCount(used, entitlement), consultant: null };
}

export { toQaChatAccess } from "./qa-access";
