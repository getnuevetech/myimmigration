/**
 * Phase −1.9 L1 — publish / list de-identified observations.
 * Cross-user readers only receive anonymized payloads (promotion_level 0 until L5+).
 */

import { db } from "@/lib/db";
import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  type AnonymizedExperienceRecord,
} from "./deidentify";

export async function publishAnonymizedObservation(opts: {
  record: ExperienceRecordV0;
  situationId: string;
}): Promise<{ id: string; anon: AnonymizedExperienceRecord }> {
  const anon = deidentifyExperienceRecord(opts.record, { sourceId: opts.situationId });
  assertSafeForSharedExperience(anon);

  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: anon.source_digest,
      decisionTarget: anon.decision_target,
      workspace: anon.workspace,
      promotionLevel: 0,
      anonJson: JSON.stringify(anon),
      sourceSituationId: opts.situationId,
    },
  });

  return { id: row.id, anon };
}

/**
 * Cross-user list API — never returns raw L0 / never returns sourceSituationId.
 * Only promotionLevel >= minLevel (default 0 for admin; production retrieval later uses 4).
 */
export async function listSharedObservations(opts?: {
  decisionTarget?: string;
  minPromotionLevel?: number;
  maxPromotionLevel?: number;
  limit?: number;
}): Promise<AnonymizedExperienceRecord[]> {
  const min = opts?.minPromotionLevel ?? 0;
  const max = opts?.maxPromotionLevel ?? 0; // L1 default: observations only; L4 retrieval comes later
  const rows = await db.experienceObservation.findMany({
    where: {
      promotionLevel: { gte: min, lte: max },
      ...(opts?.decisionTarget ? { decisionTarget: opts.decisionTarget } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
    select: { anonJson: true },
  });

  const out: AnonymizedExperienceRecord[] = [];
  for (const row of rows) {
    try {
      const anon = JSON.parse(row.anonJson) as AnonymizedExperienceRecord;
      assertSafeForSharedExperience(anon);
      out.push(anon);
    } catch {
      /* skip corrupt / unsafe */
    }
  }
  return out;
}

/** Explicit guard used by future Sol retrieval — refuses anything below L4. */
export async function listProductionPatterns(limit = 20): Promise<AnonymizedExperienceRecord[]> {
  return listSharedObservations({ minPromotionLevel: 4, maxPromotionLevel: 4, limit });
}
