/**
 * Phase −1.9 L2 — negative learning records.
 * Evaluate a turn against seeded failure patterns (compliance vs violation).
 * Never stores customer free-text — only lesson ids, keys, and evaluations.
 */

import type { NeedToKnowItem, QuestionContract } from "../conversation/types";
import {
  MEDICAL_EXAM_NEGATIVE_LESSON,
  SEEDED_NEGATIVE_LESSONS,
  isPrematureMedicalExamAsk,
  type NegativeLesson,
} from "./negative-lessons";
import { extractSituationFeatures } from "./what-mattered";

export type NegativeLearningEvaluation = "avoided" | "violated" | "not_applicable";

/** Structured L2 negative-learning outcome for one lesson on one turn. */
export type NegativeLearningRecord = {
  schema_version: "l2_negative";
  lesson_id: string;
  evaluation: NegativeLearningEvaluation;
  incorrect_ask_detected: boolean;
  preferred_fact_asked: boolean;
  situation_features_matched: string[];
  failure_type: string;
};

function clarificationKey(question: string): string {
  const q = question.toLowerCase();
  if (/inspect|parole|admitted|without inspection|border|entry/.test(q)) return "manner_of_entry";
  if (/medical|i-?693/.test(q)) return "medical_exam";
  if (/removal|nta|i-?862|proceedings/.test(q)) return "removal_proceedings";
  return "other";
}

function lessonApplicable(lesson: NegativeLesson, features: string[], decisionTarget: string): boolean {
  if (lesson.id === MEDICAL_EXAM_NEGATIVE_LESSON.id) {
    const pathwayAsk =
      decisionTarget === "identify_available_pathways" ||
      decisionTarget === "petition_eligibility_overview" ||
      decisionTarget === "identify_possible_pathways";
    if (!pathwayAsk) return false;
    // Canonical family-entry options shape: USC spouse + border + no filing.
    const matched =
      features.includes("us_citizen_spouse") &&
      features.includes("border_entry") &&
      (features.includes("no_prior_filing") || features.includes("asks_for_options"));
    return matched || pathwayAsk;
  }
  return false;
}

function evaluateOne(opts: {
  lesson: NegativeLesson;
  features: string[];
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
}): NegativeLearningRecord {
  const { lesson, features, contract, askNow } = opts;
  const matched = lesson.situation_features.filter((f) => features.includes(f));

  if (!lessonApplicable(lesson, features, contract.decision_target)) {
    return {
      schema_version: "l2_negative",
      lesson_id: lesson.id,
      evaluation: "not_applicable",
      incorrect_ask_detected: false,
      preferred_fact_asked: false,
      situation_features_matched: matched,
      failure_type: lesson.failure_type,
    };
  }

  const askQuestions = askNow.map((a) => a.question);
  const incorrect_ask_detected =
    lesson.id === MEDICAL_EXAM_NEGATIVE_LESSON.id
      ? askQuestions.some(isPrematureMedicalExamAsk) ||
        askNow.some((a) => clarificationKey(a.question) === "medical_exam")
      : askNow.some((a) => clarificationKey(a.question) === lesson.incorrect_question);

  const preferred_fact_asked = askNow.some((a) => clarificationKey(a.question) === lesson.preferred_fact);

  const evaluation: NegativeLearningEvaluation = incorrect_ask_detected ? "violated" : "avoided";

  return {
    schema_version: "l2_negative",
    lesson_id: lesson.id,
    evaluation,
    incorrect_ask_detected,
    preferred_fact_asked,
    situation_features_matched: matched.length
      ? matched
      : features.filter((f) => lesson.situation_features.includes(f)),
    failure_type: lesson.failure_type,
  };
}

/**
 * Build negative-learning records for all seeded lessons against this turn.
 */
export function buildNegativeLearningRecords(opts: {
  message: string;
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
  lessons?: NegativeLesson[];
}): NegativeLearningRecord[] {
  const features = extractSituationFeatures(opts.message);
  const lessons = opts.lessons ?? SEEDED_NEGATIVE_LESSONS;
  return lessons.map((lesson) =>
    evaluateOne({
      lesson,
      features,
      contract: opts.contract,
      askNow: opts.askNow,
    }),
  );
}

/** True when any applicable lesson was violated this turn. */
export function hasNegativeLearningViolation(records: NegativeLearningRecord[]): boolean {
  return records.some((r) => r.evaluation === "violated");
}

/** Lesson ids that were successfully avoided (compliance). */
export function avoidedNegativeLessonIds(records: NegativeLearningRecord[]): string[] {
  return records.filter((r) => r.evaluation === "avoided").map((r) => r.lesson_id);
}
