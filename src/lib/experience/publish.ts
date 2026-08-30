/**
 * Phase −1.9 L1–L4 — publish / list de-identified observations and pattern candidates.
 * Cross-user readers only receive anonymized payloads.
 * Production retrieval (listProductionPatterns) remains promotion-level-4-only.
 */

import { db } from "@/lib/db";
import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import {
  applyConsultantCorrection,
  assertIsPatternCandidate,
  buildPatternCandidate,
  type ConsultantCorrectionInput,
} from "./corrections";
import {
  applyGovernmentOutcome,
  assertIsOutcomeCandidate,
  authorityKeysRecognized,
  buildOutcomePatternCandidate,
  checkOutcomeAuthority,
  type GovernmentOutcomeInput,
} from "./outcomes";

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
 * L3 — apply consultant correction and publish a pattern candidate (promotion level 1).
 * Never elevates to L4. Never stores consultant identity in the shared payload.
 */
export async function publishPatternCandidateFromCorrection(opts: {
  record: ExperienceRecordV0;
  correction: ConsultantCorrectionInput;
  situationId?: string | null;
}): Promise<{ id: string; candidate: AnonymizedExperienceRecord; corrected: ExperienceRecordV0 }> {
  const corrected = applyConsultantCorrection(opts.record, opts.correction);
  const candidate = buildPatternCandidate(corrected, {
    sourceId: opts.situationId || `correction:${corrected.decision_target}`,
  });
  assertIsPatternCandidate(candidate);

  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: candidate.source_digest,
      decisionTarget: candidate.decision_target,
      workspace: candidate.workspace,
      promotionLevel: 1,
      anonJson: JSON.stringify(candidate),
      sourceSituationId: opts.situationId || null,
    },
  });

  return { id: row.id, candidate, corrected };
}

/**
 * L4 — apply government outcome (authority-checked) and publish a pattern candidate (level 1).
 * Outcome ≠ law; never elevates to production level 4.
 */
export async function publishPatternCandidateFromOutcome(opts: {
  record: ExperienceRecordV0;
  outcome: GovernmentOutcomeInput;
  situationId?: string | null;
  /** When provided, authority_keys must exist in this catalog (active AuthoritySource keys). */
  authorityCatalogKeys?: string[];
}): Promise<{ id: string; candidate: AnonymizedExperienceRecord; updated: ExperienceRecordV0 }> {
  const gate = checkOutcomeAuthority(opts.outcome);
  if (!gate.ok) {
    throw new Error(`Authority check failed: ${gate.reason}`);
  }

  if (opts.authorityCatalogKeys) {
    const normalized = opts.outcome.authority_keys.map((k) => String(k).trim().toLowerCase());
    const recognized = authorityKeysRecognized(normalized, opts.authorityCatalogKeys);
    if (!recognized.ok) {
      throw new Error(`Unknown authority_keys (not in active catalog): ${recognized.missing.join(", ")}`);
    }
  }

  const updated = applyGovernmentOutcome(opts.record, opts.outcome);
  const candidate = buildOutcomePatternCandidate(updated, {
    sourceId: opts.situationId || `outcome:${updated.decision_target}:${opts.outcome.outcome_kind}`,
  });
  assertIsOutcomeCandidate(candidate);

  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: candidate.source_digest,
      decisionTarget: candidate.decision_target,
      workspace: candidate.workspace,
      promotionLevel: 1,
      anonJson: JSON.stringify(candidate),
      sourceSituationId: opts.situationId || null,
    },
  });

  return { id: row.id, candidate, updated };
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

/** L3/L4 — list pattern candidates (promotion level 1) for admin / reviewer tooling. */
export async function listPatternCandidates(opts?: {
  decisionTarget?: string;
  limit?: number;
}): Promise<AnonymizedExperienceRecord[]> {
  return listSharedObservations({
    decisionTarget: opts?.decisionTarget,
    minPromotionLevel: 1,
    maxPromotionLevel: 1,
    limit: opts?.limit ?? 50,
  });
}

/** Explicit guard used by future Sol retrieval — refuses anything below L4. */
export async function listProductionPatterns(limit = 20): Promise<AnonymizedExperienceRecord[]> {
  return listSharedObservations({ minPromotionLevel: 4, maxPromotionLevel: 4, limit });
}
