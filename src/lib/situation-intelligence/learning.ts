/**
 * Phase SI-5 — map Experience corrections / negative lessons → Question Director weights.
 * Pure helpers only (no DB). Production pattern load is optional via opts.
 */

import type { QuestionCandidate, SituationFactSet } from "./types";
import {
  hasUscOrLprSpouseBasis,
  factValue,
} from "./reconcile";
import {
  MEDICAL_EXAM_NEGATIVE_LESSON,
  SEEDED_NEGATIVE_LESSONS,
  type NegativeLesson,
} from "@/lib/experience/negative-lessons";

/** Institutional / SI candidate key aliases (Experience uses some alternate labels). */
const KEY_ALIASES: Record<string, string> = {
  manner_of_entry: "entry_manner",
  entry_manner: "entry_manner",
  required_medical_exam: "medical_exam",
  medical_exam: "medical_exam",
  medical_exam_status: "medical_exam",
  required_medical: "medical_exam",
  current_location: "current_location",
  physical_location: "current_location",
  government_history: "government_history",
  prior_filing: "government_history",
  return_harm_specificity: "return_harm_specificity",
  fear_of_return: "return_harm_specificity",
  us_arrival_or_presence_start: "us_arrival_or_presence_start",
  arrival_date: "us_arrival_or_presence_start",
};

export function canonicalizeLearningKey(key: string): string {
  const k = key.trim().toLowerCase().replace(/\s+/g, "_");
  return KEY_ALIASES[k] ?? k;
}

export type SituationLearningHints = {
  suppress_keys: string[];
  prefer_keys: string[];
  negative_lesson_ids: string[];
};

export type ConsultantCorrectionHintInput = {
  incorrect_key: string;
  preferred_key: string;
  lesson_id?: string | null;
};

export function emptyLearningHints(): SituationLearningHints {
  return { suppress_keys: [], prefer_keys: [], negative_lesson_ids: [] };
}

export function mergeLearningHints(...parts: SituationLearningHints[]): SituationLearningHints {
  const suppress = new Set<string>();
  const prefer = new Set<string>();
  const lessons = new Set<string>();
  for (const p of parts) {
    for (const k of p.suppress_keys) suppress.add(canonicalizeLearningKey(k));
    for (const k of p.prefer_keys) prefer.add(canonicalizeLearningKey(k));
    for (const id of p.negative_lesson_ids) lessons.add(id);
  }
  return {
    suppress_keys: [...suppress],
    prefer_keys: [...prefer],
    negative_lesson_ids: [...lessons],
  };
}

/** Map a consultant correction into director suppress/prefer hints. */
export function hintsFromConsultantCorrection(
  correction: ConsultantCorrectionHintInput,
): SituationLearningHints {
  return {
    suppress_keys: correction.incorrect_key
      ? [canonicalizeLearningKey(correction.incorrect_key)]
      : [],
    prefer_keys: correction.preferred_key
      ? [canonicalizeLearningKey(correction.preferred_key)]
      : [],
    negative_lesson_ids: correction.lesson_id ? [correction.lesson_id] : [],
  };
}

/** Map production-pattern ask hints (Experience L6 shape) into SI keys. */
export function hintsFromProductionAskHints(hints: {
  suppress_keys: string[];
  prefer_keys: string[];
  negative_lesson_ids: string[];
}): SituationLearningHints {
  return mergeLearningHints({
    suppress_keys: hints.suppress_keys.map(canonicalizeLearningKey),
    prefer_keys: hints.prefer_keys.map(canonicalizeLearningKey),
    negative_lesson_ids: hints.negative_lesson_ids,
  });
}

function lessonAppliesToFactSet(lesson: NegativeLesson, factSet: SituationFactSet): boolean {
  if (lesson.id === MEDICAL_EXAM_NEGATIVE_LESSON.id) {
    // Premature medical exam is especially wrong for family + border/entry options Situations.
    if (!hasUscOrLprSpouseBasis(factSet)) return false;
    const features = lesson.situation_features;
    const loc = factValue(factSet, "current_location");
    const entry = factValue(factSet, "entry_manner");
    const prior = factValue(factSet, "prior_filing");
    const borderish =
      features.includes("border_entry") &&
      (entry === "border_processed" ||
        entry === "ewi" ||
        /border|parole|inspect/i.test(String(entry ?? "")) ||
        loc === "inside_us");
    const noFiling =
      !features.includes("no_prior_filing") ||
      prior === "none_reported" ||
      prior == null;
    return Boolean(borderish && noFiling);
  }
  return true;
}

/**
 * Seeded institutional lessons → director hints (always available; no DB).
 * Medical-exam premature ask is suppressed; manner-of-entry preferred when lesson applies.
 */
export function seededSituationLearningHints(factSet: SituationFactSet): SituationLearningHints {
  const parts: SituationLearningHints[] = [];
  for (const lesson of SEEDED_NEGATIVE_LESSONS) {
    if (!lessonAppliesToFactSet(lesson, factSet)) continue;
    parts.push({
      suppress_keys: [canonicalizeLearningKey(lesson.incorrect_question)],
      prefer_keys: [canonicalizeLearningKey(lesson.preferred_fact)],
      negative_lesson_ids: [lesson.id],
    });
  }
  // Always suppress medical_exam as a hard institutional default for SI interview
  // (matches Phase SI-2 gate + NEG-FAM-ENTRY-MEDICAL-001 spirit).
  parts.push({
    suppress_keys: ["medical_exam"],
    prefer_keys: [],
    negative_lesson_ids: [],
  });
  return mergeLearningHints(...parts);
}

const LEARNING_BOOST_CAP = 0.35;

/**
 * Apply suppress / prefer hints onto candidates.
 * Suppress → ask false + inflate burden. Prefer → learning_boost.
 */
export function applyLearningHints(
  candidates: QuestionCandidate[],
  hints: SituationLearningHints,
): QuestionCandidate[] {
  const suppress = new Set(hints.suppress_keys.map(canonicalizeLearningKey));
  const prefer = new Set(hints.prefer_keys.map(canonicalizeLearningKey));

  return candidates.map((c) => {
    const id = canonicalizeLearningKey(c.candidate);
    const needed = canonicalizeLearningKey(c.fact_needed);
    const hitSuppress = suppress.has(id) || suppress.has(needed);
    const hitPrefer = prefer.has(id) || prefer.has(needed);

    let next: QuestionCandidate = {
      ...c,
      learning_boost: c.learning_boost ?? 0,
    };

    if (hitPrefer) {
      next = {
        ...next,
        learning_boost: Math.min(LEARNING_BOOST_CAP, (next.learning_boost ?? 0) + 0.28),
        reason: `${next.reason} (preferred by institutional learning).`,
      };
    }

    if (hitSuppress) {
      next = {
        ...next,
        ask: false,
        customer_burden: Math.max(next.customer_burden, 0.85),
        pathway_discrimination: Math.min(next.pathway_discrimination, 0.05),
        learning_boost: 0,
        reason: `${next.reason} (suppressed by negative lesson / correction).`,
      };
    }

    return next;
  });
}

export type InterviewQualityCapture = {
  schema_version: "si-iq-0";
  asked_candidates: string[];
  ask_count: number;
  stop_reason?: string;
  ready_for_analysis: boolean;
  learning_hints: SituationLearningHints;
  suppressed_by_learning: string[];
  preferred_boosted: string[];
  premature_analysis_forbidden: true;
};

export function buildInterviewQualityCapture(opts: {
  asked_candidates: string[];
  ask_count: number;
  stop_reason?: string;
  ready_for_analysis: boolean;
  hints: SituationLearningHints;
  ranked: QuestionCandidate[];
}): InterviewQualityCapture {
  const suppressed = opts.ranked
    .filter((c) => /suppressed by negative lesson/i.test(c.reason))
    .map((c) => c.candidate);
  const preferred = opts.ranked
    .filter((c) => (c.learning_boost ?? 0) > 0)
    .map((c) => c.candidate);

  return {
    schema_version: "si-iq-0",
    asked_candidates: opts.asked_candidates,
    ask_count: opts.ask_count,
    stop_reason: opts.stop_reason,
    ready_for_analysis: opts.ready_for_analysis,
    learning_hints: opts.hints,
    suppressed_by_learning: suppressed,
    preferred_boosted: preferred,
    premature_analysis_forbidden: true,
  };
}

/** Merge interview-quality capture into Situation.learningEventJson without wiping Experience L0. */
export function mergeInterviewQualityIntoLearningJson(
  existingJson: string | null | undefined,
  capture: InterviewQualityCapture,
): string {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(existingJson || "{}") as Record<string, unknown>;
  } catch {
    base = {};
  }
  return JSON.stringify({
    ...base,
    si_interview_quality: capture,
    negative_lesson_ids: [
      ...new Set([
        ...((base.negative_lesson_ids as string[]) || []),
        ...capture.learning_hints.negative_lesson_ids,
      ]),
    ],
  });
}
