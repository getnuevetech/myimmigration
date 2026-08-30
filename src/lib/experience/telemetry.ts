/**
 * Phase −1.9 L7 — experience telemetry (help/harm) + stale / authority invalidation.
 *
 * Stale production patterns are excluded from Sol Experience Search.
 * Harm signals can auto-stale a pattern; authority key changes can invalidate linked patterns.
 * No live fine-tuning. No PII in telemetry reasons — institutional keys only.
 */

import { db } from "@/lib/db";
import { isInstitutionalKey } from "./corrections";

export const TELEMETRY_VERDICTS = ["help", "harm", "served"] as const;
export type TelemetryVerdict = (typeof TELEMETRY_VERDICTS)[number];

/** Auto-stale when harm clearly outweighs help. */
export const HARM_AUTO_STALE_MIN = 3;
export const HARM_AUTO_STALE_RATIO = 2; // harm >= help * 2

export type PatternTelemetrySnapshot = {
  id: string;
  sourceDigest: string;
  promotionLevel: number;
  helpCount: number;
  harmCount: number;
  staleAt: Date | null;
  staleReason: string;
  lastServedAt: Date | null;
};

export function shouldAutoStaleFromTelemetry(helpCount: number, harmCount: number): boolean {
  if (harmCount < HARM_AUTO_STALE_MIN) return false;
  return harmCount >= Math.max(HARM_AUTO_STALE_MIN, helpCount * HARM_AUTO_STALE_RATIO);
}

export function isActivelyServable(row: {
  promotionLevel: number;
  staleAt: Date | null;
}): boolean {
  return row.promotionLevel === 4 && row.staleAt == null;
}

export function normalizeStaleReason(raw: string): string {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!key || !isInstitutionalKey(key)) {
    throw new Error("stale_reason must be an institutional snake_case key.");
  }
  return key;
}

export async function recordPatternServed(opts: {
  sourceDigests: string[];
}): Promise<void> {
  const digests = [...new Set(opts.sourceDigests.filter(Boolean))];
  if (!digests.length) return;
  const now = new Date();
  await db.experienceObservation
    .updateMany({
      where: { sourceDigest: { in: digests }, promotionLevel: 4, staleAt: null },
      data: { lastServedAt: now },
    })
    .catch(() => null);
}

/**
 * Record help/harm feedback on a production pattern (by id or source digest).
 * Harm may auto-stale the pattern when thresholds are met.
 */
export async function recordPatternFeedback(opts: {
  observationId?: string;
  sourceDigest?: string;
  verdict: "help" | "harm";
  reasonKey?: string;
}): Promise<PatternTelemetrySnapshot> {
  if (opts.verdict !== "help" && opts.verdict !== "harm") {
    throw new Error("verdict must be help or harm.");
  }
  const reasonKey = opts.reasonKey ? normalizeStaleReason(opts.reasonKey) : null;

  const row = opts.observationId
    ? await db.experienceObservation.findUnique({ where: { id: opts.observationId } })
    : opts.sourceDigest
      ? await db.experienceObservation.findFirst({
          where: { sourceDigest: opts.sourceDigest, promotionLevel: 4 },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (!row) throw new Error("Pattern observation not found.");

  const helpCount = row.helpCount + (opts.verdict === "help" ? 1 : 0);
  const harmCount = row.harmCount + (opts.verdict === "harm" ? 1 : 0);
  const autoStale = shouldAutoStaleFromTelemetry(helpCount, harmCount);

  const updated = await db.experienceObservation.update({
    where: { id: row.id },
    data: {
      helpCount,
      harmCount,
      ...(autoStale && !row.staleAt
        ? {
            staleAt: new Date(),
            staleReason: reasonKey || "harm_threshold_exceeded",
          }
        : {}),
    },
  });

  return {
    id: updated.id,
    sourceDigest: updated.sourceDigest,
    promotionLevel: updated.promotionLevel,
    helpCount: updated.helpCount,
    harmCount: updated.harmCount,
    staleAt: updated.staleAt,
    staleReason: updated.staleReason,
    lastServedAt: updated.lastServedAt,
  };
}

export async function markPatternStale(opts: {
  observationId: string;
  reasonKey: string;
}): Promise<PatternTelemetrySnapshot> {
  const reason = normalizeStaleReason(opts.reasonKey);
  const updated = await db.experienceObservation.update({
    where: { id: opts.observationId },
    data: { staleAt: new Date(), staleReason: reason },
  });
  return {
    id: updated.id,
    sourceDigest: updated.sourceDigest,
    promotionLevel: updated.promotionLevel,
    helpCount: updated.helpCount,
    harmCount: updated.harmCount,
    staleAt: updated.staleAt,
    staleReason: updated.staleReason,
    lastServedAt: updated.lastServedAt,
  };
}

export async function clearPatternStale(opts: {
  observationId: string;
}): Promise<PatternTelemetrySnapshot> {
  const updated = await db.experienceObservation.update({
    where: { id: opts.observationId },
    data: { staleAt: null, staleReason: "" },
  });
  return {
    id: updated.id,
    sourceDigest: updated.sourceDigest,
    promotionLevel: updated.promotionLevel,
    helpCount: updated.helpCount,
    harmCount: updated.harmCount,
    staleAt: updated.staleAt,
    staleReason: updated.staleReason,
    lastServedAt: updated.lastServedAt,
  };
}

/**
 * Authority invalidation: mark production patterns that cite a changed/removed
 * authority catalog key as stale (excluded from Experience Search).
 */
export async function invalidatePatternsForAuthorityKey(opts: {
  authorityKey: string;
  reasonKey?: string;
}): Promise<{ marked: number }> {
  const key = String(opts.authorityKey || "")
    .trim()
    .toLowerCase();
  if (!isInstitutionalKey(key)) {
    throw new Error("authorityKey must be an institutional snake_case key.");
  }
  const reason = opts.reasonKey
    ? normalizeStaleReason(opts.reasonKey)
    : "authority_source_changed";

  const rows = await db.experienceObservation.findMany({
    where: { promotionLevel: 4, staleAt: null },
    select: { id: true, anonJson: true },
    take: 500,
  });

  let marked = 0;
  for (const row of rows) {
    try {
      const anon = JSON.parse(row.anonJson) as {
        authority_ids?: string[];
        outcome?: { authority_keys?: string[] };
      };
      const ids = [
        ...(anon.authority_ids || []),
        ...(anon.outcome?.authority_keys || []),
      ].map((k) => k.toLowerCase());
      if (!ids.includes(key)) continue;
      await db.experienceObservation.update({
        where: { id: row.id },
        data: { staleAt: new Date(), staleReason: reason },
      });
      marked += 1;
    } catch {
      /* skip corrupt */
    }
  }
  return { marked };
}

/** Filter helper for search — drop stale / non-production before ranking. */
export function filterServableProductionRows<
  T extends { promotionLevel: number; staleAt: Date | null; anonJson: string },
>(rows: T[]): T[] {
  return rows.filter((row) => isActivelyServable(row));
}
