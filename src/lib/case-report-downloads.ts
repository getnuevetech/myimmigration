import "server-only";
import { db } from "./db";
import { featureLimit, hasFeature } from "./access";
import { getNumberSetting } from "./settings";
import { FEATURE_KEYS } from "./constants";

export type CaseReportQuota = {
  hasAccess: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  overageCents: number;
  overLimit: boolean;
};

export async function getCaseReportQuota(userId: string): Promise<CaseReportQuota> {
  const [hasAccess, limit, used, overageCents] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.CASE_REPORT),
    featureLimit(userId, FEATURE_KEYS.CASE_REPORT),
    db.caseReportDownload.count({ where: { userId } }),
    getNumberSetting("billing.case_report_overage_cents", 500),
  ]);
  return {
    hasAccess,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overageCents,
    overLimit: hasAccess && limit !== null && used >= limit,
  };
}

export async function recordCaseReportDownload(userId: string, caseId: string, transactionId?: string | null) {
  await db.caseReportDownload.create({
    data: { userId, caseId, transactionId: transactionId ?? null },
  });
}
