/**
 * Phase −1.9 L3 — consultant corrections → pattern candidates.
 * Corrections teach institutional patterns; never share identities.
 * Candidates land at promotion_level 1. Production retrieval remains L4-only.
 */

import type { ExperienceRecordV0 } from "./experience-record";
import type { WorkspaceId } from "../conversation/types";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  textLooksLikePii,
  type AnonymizedCorrection,
  type AnonymizedExperienceRecord,
  type PromotionLevel,
} from "./deidentify";
import { MEDICAL_EXAM_NEGATIVE_LESSON } from "./negative-lessons";

export const CORRECTION_FAILURE_TYPES = [
  "premature_clarification",
  "wrong_workspace",
  "wrong_pathway",
  "missed_decision_fact",
  "incorrect_decision_target",
  "other",
] as const;

export type CorrectionFailureType = (typeof CORRECTION_FAILURE_TYPES)[number];

/** Institutional keys only — no free-text PII. */
export type ConsultantCorrectionInput = {
  failure_type: CorrectionFailureType;
  /** What the system asked / used incorrectly (fact key). */
  incorrect_key: string;
  /** What should have driven the decision instead. */
  preferred_key: string;
  /** Short institutional note key (snake_case), not a customer narrative. */
  note_key: string;
  lesson_id?: string | null;
  corrected_decision_target?: string;
  corrected_workspace?: WorkspaceId;
};

export type ReviewerCorrection = {
  origin: "consultant_correction";
  note: string;
  failure_type: CorrectionFailureType;
  incorrect_key: string;
  preferred_key: string;
  lesson_id: string | null;
};

/** Pattern candidates from corrections are promotion level 1 (Candidate). */
export const PATTERN_CANDIDATE_LEVEL: PromotionLevel = 1;

const KEY_RE = /^[a-z][a-z0-9_]{1,64}$/;

export function isInstitutionalKey(value: string): boolean {
  return KEY_RE.test(String(value || "").trim());
}

export function normalizeCorrectionInput(raw: ConsultantCorrectionInput): ConsultantCorrectionInput {
  const failure_type = CORRECTION_FAILURE_TYPES.includes(raw.failure_type)
    ? raw.failure_type
    : "other";
  const incorrect_key = String(raw.incorrect_key || "").trim().toLowerCase();
  const preferred_key = String(raw.preferred_key || "").trim().toLowerCase();
  const note_key = String(raw.note_key || "").trim().toLowerCase();
  const lesson_id = raw.lesson_id ? String(raw.lesson_id).trim() : null;

  if (!isInstitutionalKey(incorrect_key)) {
    throw new Error("incorrect_key must be an institutional snake_case key.");
  }
  if (!isInstitutionalKey(preferred_key)) {
    throw new Error("preferred_key must be an institutional snake_case key.");
  }
  if (!isInstitutionalKey(note_key)) {
    throw new Error("note_key must be an institutional snake_case key.");
  }
  if (textLooksLikePii(incorrect_key) || textLooksLikePii(preferred_key) || textLooksLikePii(note_key)) {
    throw new Error("Correction keys must not contain PII-like patterns.");
  }
  if (lesson_id && textLooksLikePii(lesson_id)) {
    throw new Error("lesson_id must not contain PII-like patterns.");
  }

  return {
    failure_type,
    incorrect_key,
    preferred_key,
    note_key,
    lesson_id,
    corrected_decision_target: raw.corrected_decision_target
      ? String(raw.corrected_decision_target).trim()
      : undefined,
    corrected_workspace: raw.corrected_workspace,
  };
}

/** Infer medical-exam negative lesson when correction matches the seeded failure. */
export function inferLessonId(correction: ConsultantCorrectionInput): string | null {
  if (correction.lesson_id) return correction.lesson_id;
  if (
    correction.failure_type === "premature_clarification" &&
    correction.incorrect_key === "medical_exam" &&
    correction.preferred_key === "manner_of_entry"
  ) {
    return MEDICAL_EXAM_NEGATIVE_LESSON.id;
  }
  return null;
}

/**
 * Apply a consultant correction onto a turn's experience record (owner-scoped).
 * Updates reviewer_correction and fact partitions; does not publish.
 */
export function applyConsultantCorrection(
  record: ExperienceRecordV0,
  raw: ConsultantCorrectionInput,
): ExperienceRecordV0 {
  const correction = normalizeCorrectionInput(raw);
  const lesson_id = inferLessonId(correction);

  const discarded = unique([
    ...(record.facts_discarded ?? record.facts_not_needed_yet ?? []),
    correction.incorrect_key,
  ]).filter((k) => k !== correction.preferred_key);

  const decision_changing_facts = unique([
    ...record.decision_changing_facts.filter((k) => k !== correction.incorrect_key),
    correction.preferred_key,
  ]);

  const facts_considered = unique([
    ...record.facts_considered,
    correction.incorrect_key,
    correction.preferred_key,
  ]);

  const negative_lesson_ids = unique([
    ...record.negative_lesson_ids,
    ...(lesson_id ? [lesson_id] : []),
  ]);

  const reviewer_correction: ReviewerCorrection = {
    origin: "consultant_correction",
    note: correction.note_key,
    failure_type: correction.failure_type,
    incorrect_key: correction.incorrect_key,
    preferred_key: correction.preferred_key,
    lesson_id,
  };

  return {
    ...record,
    decision_target: correction.corrected_decision_target || record.decision_target,
    workspace: correction.corrected_workspace || record.workspace,
    question_contract: {
      ...record.question_contract,
      decision_target: correction.corrected_decision_target || record.question_contract.decision_target,
    },
    facts_considered,
    decision_changing_facts,
    facts_discarded: discarded,
    facts_not_needed_yet: discarded,
    clarifications_suppressed: unique([...record.clarifications_suppressed, correction.incorrect_key]),
    reviewer_correction,
    negative_lesson_ids,
    capture_enrichment: "l2",
  };
}

export function correctionToAnon(correction: ReviewerCorrection): AnonymizedCorrection {
  return {
    origin: "consultant_correction",
    failure_type: correction.failure_type,
    incorrect_key: correction.incorrect_key,
    preferred_key: correction.preferred_key,
    note_key: correction.note,
    lesson_id: correction.lesson_id,
  };
}

/**
 * Build a shareable pattern candidate (promotion level 1) from a corrected record.
 * Never includes raw free-text or owner ids.
 */
export function buildPatternCandidate(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  if (!record.reviewer_correction || record.reviewer_correction.origin !== "consultant_correction") {
    throw new Error("Pattern candidate requires a consultant reviewer_correction.");
  }
  const anon = deidentifyExperienceRecord(record, opts);
  const candidate: AnonymizedExperienceRecord = {
    ...anon,
    promotion_level: PATTERN_CANDIDATE_LEVEL,
    has_reviewer_correction: true,
    correction: correctionToAnon(record.reviewer_correction as ReviewerCorrection),
    origin: "consultant_correction",
  };
  assertSafeForSharedExperience(candidate);
  return candidate;
}

export function assertIsPatternCandidate(anon: AnonymizedExperienceRecord): void {
  assertSafeForSharedExperience(anon);
  if (anon.promotion_level !== PATTERN_CANDIDATE_LEVEL) {
    throw new Error(`Expected candidate promotion_level ${PATTERN_CANDIDATE_LEVEL}, got ${anon.promotion_level}.`);
  }
  if (anon.origin !== "consultant_correction" || !anon.correction) {
    throw new Error("Candidate must carry consultant_correction provenance.");
  }
  if (anon.promotion_level >= 4) {
    throw new Error("L3 must not publish production (L4) patterns.");
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
