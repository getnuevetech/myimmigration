/**
 * Phase SI-6 — regression gate helpers (pure; fixture-driven).
 */

import type { SituationAnalysisResult } from "./analysis";
import type { DirectorResult } from "./question-director";
import type { SituationFactSet } from "./types";
import { hasUscOrLprSpouseBasis, narrativeHasUscSpouse } from "./reconcile";

export type SiRegressionFailure = { code: string; detail: string };

/** Hard ban: I-130 / USC-spouse language without family basis in Fact Set. */
export function assertNoSpouseHallucination(
  factSet: SituationFactSet,
  analysis: SituationAnalysisResult | null,
  narrative: string,
): SiRegressionFailure[] {
  const failures: SiRegressionFailure[] = [];
  const allow = hasUscOrLprSpouseBasis(factSet) || narrativeHasUscSpouse(narrative);

  if (!allow) {
    if (analysis) {
      const pathHit = analysis.presentation.pathways.some((p) =>
        /i130|spouse|family_petition/i.test(p.id + p.condition + p.explanation),
      );
      if (pathHit) {
        failures.push({
          code: "spouse_pathway_without_fact",
          detail: "Analysis presented I-130/spouse pathway without Fact Set basis",
        });
      }
      const denied = analysis.presentation.not_recommended.some((n) => /I-130|spouse/i.test(n));
      const pathText = analysis.presentation.pathways.map((p) => p.condition + p.explanation).join(" ");
      if (/\bI-130\b/i.test(pathText) && !denied) {
        failures.push({
          code: "spouse_language_in_sol",
          detail: "SOL pathway text mentions I-130 without family basis",
        });
      }
    }
  }
  return failures;
}

/**
 * Underspecified Situations must not unlock analysis while a high-value
 * orientation question remains (telemetry: full_personalized_analysis_before_fact_orientation → 0).
 */
export function assertNoPrematureAnalysis(
  factSet: SituationFactSet,
  director: DirectorResult,
): SiRegressionFailure[] {
  const failures: SiRegressionFailure[] = [];
  const locationKnown = factSet.facts.some(
    (f) => f.key === "current_location" && f.state !== "unknown" && f.value != null && f.value !== "",
  );

  if (!locationKnown && director.interview.asked_count === 0 && director.next) {
    // Expected healthy path — no failure
    return failures;
  }

  if (!locationKnown && director.ready_for_analysis && !director.next && director.interview.asked_count === 0) {
    failures.push({
      code: "premature_analysis_before_orientation",
      detail: "Ready for analysis with unknown location and zero interview asks",
    });
  }

  if (director.next && director.ready_for_analysis) {
    failures.push({
      code: "ready_while_next_exists",
      detail: `Director marked ready_for_analysis while next=${director.next.candidate}`,
    });
  }

  return failures;
}

export function assertMedicalExamNotAsked(director: DirectorResult): SiRegressionFailure[] {
  if (director.next?.candidate === "medical_exam") {
    return [{ code: "medical_exam_asked", detail: "Medical exam must not be the next interview ask" }];
  }
  const medical = director.ranked.find((c) => c.candidate === "medical_exam");
  if (medical?.ask) {
    return [{ code: "medical_exam_ask_true", detail: "Medical exam candidate cleared ask gate" }];
  }
  return [];
}
