/**
 * Phase −1.9 L4 — government outcome signals → pattern candidates (authority-checked).
 *
 * Rules:
 * - Outcome ≠ law. Outcomes never outrank CURRENT AUTHORITY.
 * - Candidates land at promotion_level 1 (same ladder as L3 corrections).
 * - Never auto-promote to production (level 4) / never enable Sol Experience Search.
 * - Shared payloads: institutional keys only — no identities, receipts, or free-text PII.
 */

import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  textLooksLikePii,
  type AnonymizedExperienceRecord,
  type AnonymizedOutcome,
  type PromotionLevel,
} from "./deidentify";
import { isInstitutionalKey, PATTERN_CANDIDATE_LEVEL } from "./corrections";

export const OUTCOME_KINDS = [
  "approved",
  "denied",
  "rfe_issued",
  "noid_issued",
  "interview_scheduled",
  "receipt_issued",
  "appeal_pending",
  "motion_pending",
  "withdrawn",
  "administratively_closed",
  "other_government_action",
] as const;

export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const GOVERNMENT_SYSTEMS = ["uscis", "eoir", "ice_cbp_removal"] as const;
export type GovernmentSystem = (typeof GOVERNMENT_SYSTEMS)[number];

export const ALLOWED_AUTHORITY_PUBLISHERS = ["USCIS", "EOIR", "ICE", "CBP", "DOL", "DOS"] as const;
export type AuthorityPublisher = (typeof ALLOWED_AUTHORITY_PUBLISHERS)[number];

/** Precedence ladder from Phase −1.9 — outcomes are historical experience only. */
export const AUTHORITY_PRECEDENCE = [
  "current_authority",
  "reviewed_internal_rule",
  "validated_production_pattern",
  "historical_experience",
  "model_inference",
] as const;

export type AuthorityPrecedence = (typeof AUTHORITY_PRECEDENCE)[number];

export type GovernmentOutcomeInput = {
  outcome_kind: OutcomeKind;
  government_system: GovernmentSystem;
  /** Institutional form/notice key, e.g. i_485, rfe, i_797. */
  form_or_notice_key: string;
  /** Fact keys believed to have mattered for this outcome. */
  decision_changing_facts?: string[];
  /** Authority catalog keys (not customer receipt numbers). */
  authority_keys: string[];
  authority_publisher: AuthorityPublisher | string;
  note_key: string;
};

export type AuthorityCheckResult = {
  ok: boolean;
  reason: string;
  /** Where this signal sits on the precedence ladder — always historical_experience when ok. */
  signal_precedence: AuthorityPrecedence;
  /** Reminder: still outranked by current authority. */
  outranked_by: "current_authority";
};

export type AppliedGovernmentOutcome = {
  kind: OutcomeKind;
  detail: string;
  government_system: GovernmentSystem;
  form_or_notice_key: string;
  authority_keys: string[];
  authority_publisher: string;
  authority_check: "passed";
  signal_precedence: "historical_experience";
};

export const OUTCOME_CANDIDATE_LEVEL: PromotionLevel = PATTERN_CANDIDATE_LEVEL;

function normalizePublisher(raw: string): string {
  return String(raw || "").trim().toUpperCase();
}

export function normalizeOutcomeInput(raw: GovernmentOutcomeInput): GovernmentOutcomeInput {
  const outcome_kind = OUTCOME_KINDS.includes(raw.outcome_kind) ? raw.outcome_kind : "other_government_action";
  const government_system = GOVERNMENT_SYSTEMS.includes(raw.government_system)
    ? raw.government_system
    : (() => {
        throw new Error("government_system must be uscis, eoir, or ice_cbp_removal.");
      })();

  const form_or_notice_key = String(raw.form_or_notice_key || "").trim().toLowerCase();
  const note_key = String(raw.note_key || "").trim().toLowerCase();
  const authority_keys = (raw.authority_keys || []).map((k) => String(k).trim().toLowerCase()).filter(Boolean);
  const decision_changing_facts = (raw.decision_changing_facts || [])
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean);
  const authority_publisher = normalizePublisher(String(raw.authority_publisher || ""));

  if (!isInstitutionalKey(form_or_notice_key)) {
    throw new Error("form_or_notice_key must be an institutional snake_case key.");
  }
  if (!isInstitutionalKey(note_key)) {
    throw new Error("note_key must be an institutional snake_case key.");
  }
  for (const key of [...authority_keys, ...decision_changing_facts]) {
    if (!isInstitutionalKey(key)) {
      throw new Error(`Invalid institutional key: ${key}`);
    }
    if (/^(msc|eac|wac|lin|src|ioe|nbc)\d+$/i.test(key)) {
      throw new Error("authority_keys must be catalog keys, not receipt numbers.");
    }
    if (textLooksLikePii(key)) {
      throw new Error("Outcome keys must not contain PII-like patterns.");
    }
  }
  if (textLooksLikePii(form_or_notice_key) || textLooksLikePii(note_key) || textLooksLikePii(authority_publisher)) {
    throw new Error("Outcome fields must not contain PII-like patterns.");
  }

  return {
    outcome_kind,
    government_system,
    form_or_notice_key,
    decision_changing_facts,
    authority_keys,
    authority_publisher,
    note_key,
  };
}

/**
 * Authority check for outcome → candidate.
 * Passes only when a recognized government publisher + authority keys are present.
 * Never treats the outcome itself as current law.
 */
export function checkOutcomeAuthority(raw: GovernmentOutcomeInput): AuthorityCheckResult {
  let input: GovernmentOutcomeInput;
  try {
    input = normalizeOutcomeInput(raw);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Invalid outcome input.",
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }

  const publisherOk = (ALLOWED_AUTHORITY_PUBLISHERS as readonly string[]).includes(input.authority_publisher);
  if (!publisherOk) {
    return {
      ok: false,
      reason: `authority_publisher must be one of ${ALLOWED_AUTHORITY_PUBLISHERS.join(", ")}.`,
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }

  if (!input.authority_keys.length) {
    return {
      ok: false,
      reason: "At least one authority_key is required (catalog key, not a customer receipt).",
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }

  // Reject receipt-number-shaped "authority" keys — those are customer identifiers, not catalog keys.
  if (input.authority_keys.some((k) => /^(msc|eac|wac|lin|src|ioe|nbc)\d+$/i.test(k))) {
    return {
      ok: false,
      reason: "authority_keys must be catalog keys, not receipt numbers.",
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }

  return {
    ok: true,
    reason: "Outcome linked to recognized government publisher; treated as historical experience only (outcome ≠ law).",
    signal_precedence: "historical_experience",
    outranked_by: "current_authority",
  };
}

/**
 * Optional DB-backed check: authority_keys should match active AuthoritySource.key rows when provided.
 * Pure checkOutcomeAuthority still gates publish; this strengthens when catalog is available.
 */
export function authorityKeysRecognized(
  authorityKeys: string[],
  catalogKeys: string[],
): { ok: boolean; missing: string[] } {
  const catalog = new Set(catalogKeys.map((k) => k.toLowerCase()));
  const missing = authorityKeys.filter((k) => !catalog.has(k.toLowerCase()));
  // Empty catalog → skip strict match (dev / fixture environments).
  if (catalog.size === 0) return { ok: true, missing: [] };
  return { ok: missing.length === 0, missing };
}

/**
 * Apply a government outcome onto a turn's experience record (owner-scoped).
 */
export function applyGovernmentOutcome(
  record: ExperienceRecordV0,
  raw: GovernmentOutcomeInput,
): ExperienceRecordV0 {
  const check = checkOutcomeAuthority(raw);
  if (!check.ok) {
    throw new Error(`Authority check failed: ${check.reason}`);
  }
  const input = normalizeOutcomeInput(raw);
  const decision_changing_facts = unique([
    ...record.decision_changing_facts,
    ...(input.decision_changing_facts || []),
  ]);
  const facts_considered = unique([
    ...record.facts_considered,
    input.form_or_notice_key,
    input.outcome_kind,
    ...(input.decision_changing_facts || []),
  ]);
  const authority_ids = unique([...record.authority_ids, ...input.authority_keys]);

  const outcome: AppliedGovernmentOutcome = {
    kind: input.outcome_kind,
    detail: input.note_key,
    government_system: input.government_system,
    form_or_notice_key: input.form_or_notice_key,
    authority_keys: input.authority_keys,
    authority_publisher: input.authority_publisher,
    authority_check: "passed",
    signal_precedence: "historical_experience",
  };

  return {
    ...record,
    facts_considered,
    decision_changing_facts,
    authority_ids,
    outcome,
    existing_government_case: true,
    capture_enrichment: "l2",
  };
}

export function outcomeToAnon(outcome: AppliedGovernmentOutcome): AnonymizedOutcome {
  return {
    origin: "government_outcome",
    outcome_kind: outcome.kind,
    government_system: outcome.government_system,
    form_or_notice_key: outcome.form_or_notice_key,
    authority_keys: [...outcome.authority_keys],
    authority_publisher: outcome.authority_publisher,
    note_key: outcome.detail,
    signal_precedence: "historical_experience",
    outranked_by: "current_authority",
  };
}

/**
 * Build a shareable pattern candidate from an authority-checked government outcome.
 */
export function buildOutcomePatternCandidate(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  const outcome = record.outcome as AppliedGovernmentOutcome | null;
  if (!outcome || outcome.authority_check !== "passed") {
    throw new Error("Outcome candidate requires an authority-checked government outcome.");
  }
  const anon = deidentifyExperienceRecord(record, opts);
  const candidate: AnonymizedExperienceRecord = {
    ...anon,
    promotion_level: OUTCOME_CANDIDATE_LEVEL,
    origin: "government_outcome",
    outcome_kind: outcome.kind,
    outcome: outcomeToAnon(outcome),
    authority_ids: unique([...anon.authority_ids, ...outcome.authority_keys]),
  };
  assertSafeForSharedExperience(candidate);
  assertIsOutcomeCandidate(candidate);
  return candidate;
}

export function assertIsOutcomeCandidate(anon: AnonymizedExperienceRecord): void {
  assertSafeForSharedExperience(anon);
  if (anon.promotion_level !== OUTCOME_CANDIDATE_LEVEL) {
    throw new Error(`Expected candidate promotion_level ${OUTCOME_CANDIDATE_LEVEL}, got ${anon.promotion_level}.`);
  }
  if (anon.origin !== "government_outcome" || !anon.outcome) {
    throw new Error("Candidate must carry government_outcome provenance.");
  }
  if (anon.outcome.signal_precedence !== "historical_experience") {
    throw new Error("Outcome candidates must remain historical_experience (outcome ≠ law).");
  }
  if (anon.promotion_level >= 4) {
    throw new Error("L4 delivery must not publish production (promotion level 4) patterns.");
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
