/**
 * Seeded negative-learning lessons (Phase −1.9 / L0).
 * These are institutional failure patterns — not customer PII.
 */

export type NegativeLesson = {
  id: string;
  failure_type: string;
  situation_features: string[];
  user_question_pattern: string;
  incorrect_question: string;
  reason: string;
  preferred_fact: string;
  correct_behavior: string[];
  lesson: string;
  promotion_level: 0 | 1 | 2 | 3 | 4;
  /** Seeded lessons start as Reviewed (L3) institutional knowledge; production retrieval still L4-only via Pattern Registry. */
  seeded: true;
};

/**
 * Canonical failure: medical-exam ask for unfiled USC-spouse border options.
 * First seeded negative-learning fixture per S0 lock.
 */
export const MEDICAL_EXAM_NEGATIVE_LESSON: NegativeLesson = {
  id: "NEG-FAM-ENTRY-MEDICAL-001",
  failure_type: "premature_clarification",
  situation_features: [
    "us_citizen_spouse",
    "border_entry",
    "no_prior_filing",
    "several_years_us_presence",
  ],
  user_question_pattern: "identify_available_options",
  incorrect_question: "required_medical_exam",
  reason: "did_not_change_initial_pathway",
  preferred_fact: "manner_of_entry",
  correct_behavior: [
    "explain_primary_pathways_first",
    "identify_inspection_admission_parole_as_controlling",
    "ask_targeted_border_processing_question",
    "do_not_create_case",
    "do_not_run_full_v51",
  ],
  lesson: "schema completeness must not outrank question relevance",
  promotion_level: 3,
  seeded: true,
};

export const SEEDED_NEGATIVE_LESSONS: NegativeLesson[] = [MEDICAL_EXAM_NEGATIVE_LESSON];

export function findNegativeLessonsForDecisionTarget(decisionTarget: string): NegativeLesson[] {
  if (
    decisionTarget === "identify_available_pathways" ||
    decisionTarget === "petition_eligibility_overview" ||
    decisionTarget === "identify_possible_pathways"
  ) {
    return [MEDICAL_EXAM_NEGATIVE_LESSON];
  }
  return [];
}

export function isPrematureMedicalExamAsk(question: string): boolean {
  return /medical\s*exam|i-?693|required medical/i.test(question);
}
