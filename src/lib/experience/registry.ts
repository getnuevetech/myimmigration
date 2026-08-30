/**
 * Phase −1.9 L5 — Pattern Registry: list + promote ExperienceObservation 0→4.
 * Only promotion level 4 is eligible for Sol Experience Search (L6).
 * Admin UI / reviewer tools only — never customer-facing retrieval here.
 */

import { db } from "@/lib/db";
import {
  assertSafeForSharedExperience,
  type AnonymizedExperienceRecord,
  type PromotionLevel,
} from "./deidentify";

export type { PromotionLevel };
export const PROMOTION_LABELS: Record<PromotionLevel, string> = {
  0: "Observation",
  1: "Candidate",
  2: "Supported",
  3: "Reviewed",
  4: "Production",
};

export const PROMOTION_LEVELS: PromotionLevel[] = [0, 1, 2, 3, 4];

export type RegistryEntry = {
  id: string;
  promotionLevel: PromotionLevel;
  decisionTarget: string;
  workspace: string;
  createdAt: Date;
  /** Admin audit only — never exposed via customer cross-user list APIs. */
  sourceSituationId: string | null;
  anon: AnonymizedExperienceRecord;
  /** L7 telemetry */
  helpCount: number;
  harmCount: number;
  staleAt: Date | null;
  staleReason: string;
  lastServedAt: Date | null;
};

export function isPromotionLevel(value: unknown): value is PromotionLevel {
  return value === 0 || value === 1 || value === 2 || value === 3 || value === 4;
}

export function parsePromotionLevel(raw: unknown): PromotionLevel {
  const n = typeof raw === "string" ? Number(raw) : Number(raw);
  if (!isPromotionLevel(n)) {
    throw new Error("Promotion level must be an integer 0–4.");
  }
  return n;
}

/**
 * Production (4) requires a reusable institutional signal — not an empty turn shell.
 */
export function canPromoteToProduction(anon: AnonymizedExperienceRecord): { ok: boolean; reason: string } {
  if (!anon.decision_target?.trim()) {
    return { ok: false, reason: "Production patterns require a decision_target." };
  }
  const hasSignal =
    anon.has_reviewer_correction ||
    Boolean(anon.outcome_kind) ||
    Boolean(anon.correction) ||
    Boolean(anon.outcome) ||
    (anon.negative_lesson_ids?.length ?? 0) > 0 ||
    (anon.decision_changing_facts?.length ?? 0) > 0;
  if (!hasSignal) {
    return {
      ok: false,
      reason:
        "Production requires a correction, government outcome, negative lesson, or decision-changing fact.",
    };
  }
  return { ok: true, reason: "Eligible for Production (still outranked by current authority)." };
}

export function validatePromotionTarget(
  anon: AnonymizedExperienceRecord,
  toLevel: PromotionLevel,
): { ok: boolean; reason: string } {
  if (!isPromotionLevel(toLevel)) {
    return { ok: false, reason: "Invalid promotion level." };
  }
  if (toLevel === 4) {
    return canPromoteToProduction(anon);
  }
  return { ok: true, reason: `May set level to ${toLevel} (${PROMOTION_LABELS[toLevel]}).` };
}

function parseAnon(raw: string): AnonymizedExperienceRecord {
  const anon = JSON.parse(raw) as AnonymizedExperienceRecord;
  assertSafeForSharedExperience(anon);
  return anon;
}

/** Admin registry list — includes row id; still never returns raw L0 free-text. */
export async function listRegistryEntries(opts?: {
  level?: PromotionLevel | "all";
  decisionTarget?: string;
  limit?: number;
}): Promise<RegistryEntry[]> {
  const level = opts?.level ?? "all";
  const rows = await db.experienceObservation.findMany({
    where: {
      ...(level === "all" ? {} : { promotionLevel: level }),
      ...(opts?.decisionTarget ? { decisionTarget: opts.decisionTarget } : {}),
    },
    orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 100,
    select: {
      id: true,
      promotionLevel: true,
      decisionTarget: true,
      workspace: true,
      createdAt: true,
      sourceSituationId: true,
      anonJson: true,
      helpCount: true,
      harmCount: true,
      staleAt: true,
      staleReason: true,
      lastServedAt: true,
    },
  });

  const out: RegistryEntry[] = [];
  for (const row of rows) {
    try {
      const anon = parseAnon(row.anonJson);
      const promotionLevel = isPromotionLevel(row.promotionLevel) ? row.promotionLevel : 0;
      out.push({
        id: row.id,
        promotionLevel,
        decisionTarget: row.decisionTarget,
        workspace: row.workspace,
        createdAt: row.createdAt,
        sourceSituationId: row.sourceSituationId,
        anon: { ...anon, promotion_level: promotionLevel },
        helpCount: row.helpCount,
        harmCount: row.harmCount,
        staleAt: row.staleAt,
        staleReason: row.staleReason,
        lastServedAt: row.lastServedAt,
      });
    } catch {
      /* skip corrupt / unsafe */
    }
  }
  return out;
}

export async function countRegistryByLevel(): Promise<Record<PromotionLevel, number>> {
  const groups = await db.experienceObservation.groupBy({
    by: ["promotionLevel"],
    _count: { _all: true },
  });
  const counts: Record<PromotionLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const g of groups) {
    if (isPromotionLevel(g.promotionLevel)) {
      counts[g.promotionLevel] = g._count._all;
    }
  }
  return counts;
}

/**
 * Set promotion level 0–4 on a registry row. Updates both column and anonJson.promotion_level.
 * Does not fine-tune models. Level 4 remains gated by canPromoteToProduction.
 */
export async function setPatternPromotionLevel(opts: {
  id: string;
  toLevel: PromotionLevel;
}): Promise<{ id: string; fromLevel: PromotionLevel; toLevel: PromotionLevel; anon: AnonymizedExperienceRecord }> {
  const toLevel = parsePromotionLevel(opts.toLevel);
  const row = await db.experienceObservation.findUnique({
    where: { id: opts.id },
    select: { id: true, promotionLevel: true, anonJson: true },
  });
  if (!row) throw new Error("Pattern observation not found.");

  const anon = parseAnon(row.anonJson);
  const fromLevel = isPromotionLevel(row.promotionLevel) ? row.promotionLevel : 0;
  const gate = validatePromotionTarget(anon, toLevel);
  if (!gate.ok) throw new Error(gate.reason);

  const nextAnon: AnonymizedExperienceRecord = {
    ...anon,
    promotion_level: toLevel,
  };
  assertSafeForSharedExperience(nextAnon);

  await db.experienceObservation.update({
    where: { id: row.id },
    data: {
      promotionLevel: toLevel,
      anonJson: JSON.stringify(nextAnon),
    },
  });

  return { id: row.id, fromLevel, toLevel, anon: nextAnon };
}
