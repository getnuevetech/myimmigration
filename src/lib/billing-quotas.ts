/**
 * Phase Billing — quotas for Filing Plan builds and form wizards.
 * Plus is capped; Pro is unlimited. Free cannot build plans or run wizards.
 */
import "server-only";
import { db } from "@/lib/db";
import { featureLimit, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export type FeatureQuota = {
  hasAccess: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  overLimit: boolean;
};

export async function getFilingPlanQuota(userId: string): Promise<FeatureQuota> {
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.FILING_PLAN_BUILD),
    featureLimit(userId, FEATURE_KEYS.FILING_PLAN_BUILD),
    db.filingPlan.count({
      where: { situation: { userId }, createdAt: { gte: since } },
    }),
  ]);
  return {
    hasAccess,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overLimit: hasAccess && limit !== null && used >= limit,
  };
}

export async function getFormWizardQuota(userId: string): Promise<FeatureQuota> {
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.FORMS),
    featureLimit(userId, FEATURE_KEYS.FORMS),
    db.formSubmission.count({
      where: { userId, createdAt: { gte: since } },
    }),
  ]);
  return {
    hasAccess,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overLimit: hasAccess && limit !== null && used >= limit,
  };
}

export async function getFormDownloadQuota(userId: string): Promise<FeatureQuota> {
  // Downloads are gated by feature flag; count completed submissions this month as a soft meter.
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.FORMS_DOWNLOAD),
    featureLimit(userId, FEATURE_KEYS.FORMS_DOWNLOAD),
    db.formSubmission.count({
      where: { userId, status: "completed", updatedAt: { gte: since } },
    }),
  ]);
  return {
    hasAccess,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overLimit: hasAccess && limit !== null && used >= limit,
  };
}
