/**
 * Phase −1.9 L6 — Experience Search for Sol (production patterns only).
 *
 * Rules:
 * - Only promotion_level === 4 patterns may be retrieved for Sol.
 * - Patterns are VALIDATED PRODUCTION PATTERN — still outranked by CURRENT AUTHORITY
 *   and REVIEWED INTERNAL RULE. Outcome ≠ law.
 * - No live fine-tuning. Keys / institutional labels only (already de-identified).
 */

import type { AnonymizedExperienceRecord } from "./deidentify";
import { listProductionPatterns } from "./publish";
import { assertSafeForSharedExperience } from "./deidentify";

export type ExperienceSearchQuery = {
  decisionTarget?: string;
  workspace?: string;
  factKeys?: string[];
  pathways?: string[];
  negativeLessonIds?: string[];
  limit?: number;
};

export type ExperienceSearchHit = {
  pattern: AnonymizedExperienceRecord;
  score: number;
  match_reasons: string[];
};

export const EXPERIENCE_SEARCH_PRECEDENCE =
  "CURRENT AUTHORITY > REVIEWED INTERNAL RULE > VALIDATED PRODUCTION PATTERN > HISTORICAL EXPERIENCE > MODEL INFERENCE";

/** Hard gate: refuse any pattern that is not promotion level 4. */
export function assertAllProductionLevel(patterns: AnonymizedExperienceRecord[]): void {
  for (const p of patterns) {
    assertSafeForSharedExperience(p);
    if (p.promotion_level !== 4) {
      throw new Error(
        `Experience Search refuses non-production pattern (promotion_level=${p.promotion_level}). Only level 4 is allowed.`,
      );
    }
  }
}

function overlapCount(a: string[] | undefined, b: string[] | undefined): number {
  if (!a?.length || !b?.length) return 0;
  const set = new Set(b.map((x) => x.toLowerCase()));
  return a.filter((x) => set.has(x.toLowerCase())).length;
}

/**
 * Rank already-fetched production patterns for a query (pure; testable without DB).
 */
export function rankProductionPatterns(
  patterns: AnonymizedExperienceRecord[],
  query: ExperienceSearchQuery,
): ExperienceSearchHit[] {
  assertAllProductionLevel(patterns);
  const limit = query.limit ?? 5;
  const target = (query.decisionTarget || "").toLowerCase();
  const workspace = (query.workspace || "").toLowerCase();
  const factKeys = (query.factKeys || []).map((k) => k.toLowerCase());
  const pathways = (query.pathways || []).map((k) => k.toLowerCase());
  const lessons = (query.negativeLessonIds || []).map((k) => k.toLowerCase());

  const hits: ExperienceSearchHit[] = [];
  for (const pattern of patterns) {
    const reasons: string[] = [];
    let score = 0;

    if (target && pattern.decision_target.toLowerCase() === target) {
      score += 5;
      reasons.push("decision_target");
    } else if (target && pattern.decision_target.toLowerCase().includes(target.slice(0, 12))) {
      score += 2;
      reasons.push("decision_target_partial");
    }

    if (workspace && pattern.workspace.toLowerCase() === workspace) {
      score += 2;
      reasons.push("workspace");
    }

    const factOverlap = overlapCount(factKeys, [
      ...(pattern.decision_changing_facts || []),
      ...(pattern.facts_considered || []),
      ...(pattern.facts_discarded || []),
    ]);
    if (factOverlap) {
      score += factOverlap;
      reasons.push(`facts:${factOverlap}`);
    }

    const pathwayOverlap = overlapCount(pathways, pattern.pathways_considered || []);
    if (pathwayOverlap) {
      score += pathwayOverlap * 2;
      reasons.push(`pathways:${pathwayOverlap}`);
    }

    const lessonOverlap = overlapCount(lessons, pattern.negative_lesson_ids || []);
    if (lessonOverlap) {
      score += lessonOverlap * 3;
      reasons.push(`lessons:${lessonOverlap}`);
    }

    if (pattern.has_reviewer_correction || pattern.correction) {
      score += 1;
      reasons.push("consultant_correction");
    }
    if (pattern.outcome_kind || pattern.outcome) {
      score += 1;
      reasons.push("government_outcome");
    }

    if (score <= 0) continue;
    hits.push({ pattern, score, match_reasons: reasons });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Format hits for Sol prompts. Empty string when no hits.
 */
export function formatExperienceSearchBlock(hits: ExperienceSearchHit[]): string {
  if (!hits.length) return "";
  assertAllProductionLevel(hits.map((h) => h.pattern));

  const lines: string[] = [
    "=== VALIDATED PRODUCTION PATTERNS (Experience Search) ===",
    `Precedence: ${EXPERIENCE_SEARCH_PRECEDENCE}.`,
    "These are institutional patterns — not law. Outcome ≠ law. Prefer CURRENT AUTHORITY when they conflict.",
    "Do not invent customer identities, receipts, or free-text facts from patterns.",
    "",
  ];

  hits.forEach((hit, i) => {
    const p = hit.pattern;
    lines.push(`[${i + 1}] decision_target=${p.decision_target} workspace=${p.workspace} score=${hit.score}`);
    lines.push(`  match: ${hit.match_reasons.join(", ")}`);
    if (p.decision_changing_facts?.length) {
      lines.push(`  decision_changing: ${p.decision_changing_facts.join(", ")}`);
    }
    if (p.facts_discarded?.length) {
      lines.push(`  discard_early: ${p.facts_discarded.slice(0, 8).join(", ")}`);
    }
    if (p.clarification_key) {
      lines.push(`  preferred_clarification_key: ${p.clarification_key}`);
    }
    if (p.negative_lesson_ids?.length) {
      lines.push(`  negative_lessons: ${p.negative_lesson_ids.join(", ")}`);
    }
    if (p.correction) {
      lines.push(
        `  correction: ${p.correction.incorrect_key} → ${p.correction.preferred_key} (${p.correction.failure_type})`,
      );
    }
    if (p.outcome) {
      lines.push(
        `  outcome_signal: ${p.outcome.outcome_kind} / ${p.outcome.form_or_notice_key} (historical_experience only)`,
      );
    }
    lines.push("");
  });

  return lines.join("\n").trim();
}

/**
 * Load production patterns and rank for Sol. Never returns levels below 4.
 * L7: excludes stale; records served digests for telemetry.
 */
export async function searchProductionExperience(
  query: ExperienceSearchQuery,
): Promise<ExperienceSearchHit[]> {
  const limit = query.limit ?? 5;
  // Over-fetch then rank — listProductionPatterns is already level-4-only and non-stale.
  const patterns = await listProductionPatterns(Math.max(20, limit * 4));
  assertAllProductionLevel(patterns);
  const hits = rankProductionPatterns(patterns, { ...query, limit });
  if (hits.length) {
    try {
      const { recordPatternServed } = await import("./telemetry");
      await recordPatternServed({ sourceDigests: hits.map((h) => h.pattern.source_digest) });
    } catch {
      /* telemetry must not block Sol */
    }
  }
  return hits;
}

/**
 * Convenience: search + format for prompt injection.
 */
export async function buildExperienceSearchBlock(query: ExperienceSearchQuery): Promise<string> {
  try {
    const hits = await searchProductionExperience(query);
    return formatExperienceSearchBlock(hits);
  } catch {
    return "";
  }
}

/**
 * Merge discarded / preferred keys from production hits into ask suppression hints.
 * Pure helper for conversation scaffolding (no DB).
 */
export function productionPatternAskHints(hits: ExperienceSearchHit[]): {
  suppress_keys: string[];
  prefer_keys: string[];
  negative_lesson_ids: string[];
} {
  const suppress = new Set<string>();
  const prefer = new Set<string>();
  const lessons = new Set<string>();
  for (const hit of hits) {
    for (const k of hit.pattern.facts_discarded || []) suppress.add(k);
    for (const k of hit.pattern.clarifications_suppressed || []) suppress.add(k);
    if (hit.pattern.clarification_key) prefer.add(hit.pattern.clarification_key);
    for (const k of hit.pattern.decision_changing_facts || []) prefer.add(k);
    if (hit.pattern.correction) {
      suppress.add(hit.pattern.correction.incorrect_key);
      prefer.add(hit.pattern.correction.preferred_key);
    }
    for (const id of hit.pattern.negative_lesson_ids || []) lessons.add(id);
  }
  return {
    suppress_keys: [...suppress],
    prefer_keys: [...prefer],
    negative_lesson_ids: [...lessons],
  };
}
