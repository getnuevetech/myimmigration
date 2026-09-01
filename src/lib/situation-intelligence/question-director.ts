import type {
  PreScreenSignal,
  QuestionCandidate,
  SituationFact,
  SituationFactSet,
} from "./types";
import {
  FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD,
  MAX_INITIAL_INTERVIEW_QUESTIONS,
} from "./types";
import {
  factValue,
  hasHumanitarianReturnConcern,
  hasUscOrLprSpouseBasis,
} from "./reconcile";
import { runLightCountryPreScreen } from "./pre-screen";
import {
  applyLearningHints,
  mergeLearningHints,
  seededSituationLearningHints,
  type SituationLearningHints,
} from "./learning";
import { recordDirectorTelemetry } from "./telemetry";

export type InterviewState = {
  asked_count: number;
  asked_candidates: string[];
  stopped: boolean;
  stop_reason?: "threshold" | "max_questions" | "no_candidates" | "already_sufficient";
};

export type DirectorResult = {
  next: QuestionCandidate | null;
  ranked: QuestionCandidate[];
  interview: InterviewState;
  signals: PreScreenSignal[];
  ready_for_analysis: boolean;
  /** Phase SI-5 — hints applied this pass (seeded + optional production/correction). */
  learning_hints: SituationLearningHints;
};

function isResolved(set: SituationFactSet, key: string): boolean {
  const f = set.facts.find((x) => x.key === key);
  return Boolean(f && f.state !== "unknown" && f.value != null && f.value !== "");
}

function location(set: SituationFactSet): string | null {
  const v = factValue(set, "current_location");
  return typeof v === "string" ? v : null;
}

/** Value score in [0,1] for stop/rank threshold. */
export function scoreQuestionValue(c: QuestionCandidate): number {
  if (c.known || !c.dependency_satisfied) return 0;
  const base =
    (c.pathway_discrimination + c.jurisdiction_impact + c.eligibility_impact + c.urgency_impact) / 4;
  const pos = Math.min(1, base + c.pre_screen_boost + (c.learning_boost ?? 0));
  const neg = c.customer_burden * 0.6;
  return Math.max(0, Math.min(1, pos - neg));
}

function boostFor(signals: PreScreenSignal[], factNeeded: string): number {
  const hit = signals.find((s) => s.elevates_fact === factNeeded);
  if (!hit) return 0;
  return Math.min(0.45, hit.confidence * 0.5);
}

function candidate(partial: Omit<QuestionCandidate, "ask"> & { ask?: boolean }): QuestionCandidate {
  const c: QuestionCandidate = { ask: true, learning_boost: 0, ...partial };
  const value = scoreQuestionValue(c);
  c.ask = c.ask && !c.known && c.dependency_satisfied && value >= FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD;
  return c;
}

/**
 * Build all candidates from foundational + activated dims + pre-screen.
 * Does not recommend legal conclusions — only facts that discriminate research.
 */
export function buildQuestionCandidates(
  factSet: SituationFactSet,
  signals: PreScreenSignal[],
  alreadyAsked: string[],
): QuestionCandidate[] {
  const asked = new Set(alreadyAsked);
  const loc = location(factSet);
  const out: QuestionCandidate[] = [];

  const push = (c: QuestionCandidate) => {
    if (asked.has(c.candidate)) return;
    out.push(c);
  };

  // --- L1 foundational ---
  push(
    candidate({
      candidate: "current_location",
      source: "foundational_frame",
      known: isResolved(factSet, "current_location"),
      dependency_satisfied: true,
      pathway_discrimination: 0.96,
      jurisdiction_impact: 0.97,
      eligibility_impact: 0.84,
      urgency_impact: 0.55,
      customer_burden: 0.05,
      pre_screen_boost: 0,
      level: 1,
      customer_wording: "Are you currently inside the United States or outside the United States?",
      reason: "Available immigration processes differ based on physical location.",
      fact_needed: "current_location",
      branches_affected: ["inside_us_processes", "outside_us_processes"],
    }),
  );

  push(
    candidate({
      candidate: "entry_manner",
      source: "foundational_frame",
      known: isResolved(factSet, "entry_manner"),
      dependency_satisfied: loc === "inside_us" || isResolved(factSet, "entry_mentioned"),
      pathway_discrimination: 0.95,
      jurisdiction_impact: 0.85,
      eligibility_impact: 0.92,
      urgency_impact: 0.55,
      customer_burden: 0.12,
      pre_screen_boost: boostFor(signals, "entry_manner"),
      level: 1,
      customer_wording:
        "When you most recently entered the United States, how did you enter — with a visa, processed/released at the border, without being inspected, or with another document/status?",
      reason: "Entry manner often changes which processes are realistic inside the U.S.",
      fact_needed: "entry_manner",
      branches_affected: ["adjustment_of_status", "consular_processing", "status_paths"],
    }),
  );

  push(
    candidate({
      candidate: "us_arrival_or_presence_start",
      source: "foundational_frame",
      known: isResolved(factSet, "us_arrival_or_presence_start"),
      dependency_satisfied: loc === "inside_us" || loc === null,
      pathway_discrimination: 0.55,
      jurisdiction_impact: 0.4,
      eligibility_impact: 0.7,
      urgency_impact: 0.5,
      customer_burden: 0.12,
      pre_screen_boost: boostFor(signals, "us_arrival_or_presence_start"),
      level: 1,
      customer_wording: "When did you most recently arrive in (or start living in) the United States?",
      reason: "Some country-related programs and presence rules care about arrival or continuous presence dates.",
      fact_needed: "us_arrival_or_presence_start",
      branches_affected: ["presence_windows", "status_timeline"],
    }),
  );

  push(
    candidate({
      candidate: "prior_us_history",
      source: "foundational_frame",
      known: isResolved(factSet, "prior_us_history"),
      dependency_satisfied: loc === "outside_us",
      pathway_discrimination: 0.75,
      jurisdiction_impact: 0.6,
      eligibility_impact: 0.65,
      urgency_impact: 0.35,
      customer_burden: 0.12,
      pre_screen_boost: 0,
      level: 1,
      customer_wording: "Have you ever been in the United States before, or had a U.S. visa?",
      reason: "Prior U.S. travel or visas can change outside-U.S. options and risk analysis.",
      fact_needed: "prior_us_history",
      branches_affected: ["outside_us_processes", "prior_violations"],
    }),
  );

  push(
    candidate({
      candidate: "government_history",
      source: "foundational_frame",
      known: isResolved(factSet, "prior_filing") || isResolved(factSet, "court_or_removal_signal"),
      dependency_satisfied: true,
      pathway_discrimination: 0.88,
      jurisdiction_impact: 0.92,
      eligibility_impact: 0.7,
      urgency_impact: 0.6,
      customer_burden: 0.1,
      pre_screen_boost: 0,
      level: 1,
      customer_wording:
        "Have you ever applied for U.S. immigration benefits or received papers from USCIS, immigration court, Border Patrol, ICE, or a U.S. consulate?",
      reason: "Pending filings, court matters, or prior orders change who controls the next step.",
      fact_needed: "government_history",
      branches_affected: ["uscis", "eoir", "ice_cbp", "consulate"],
    }),
  );

  // Skip multi-select when a primary basis is already established from the narrative.
  const basesAlreadyOriented =
    isResolved(factSet, "possible_bases_answered") ||
    hasUscOrLprSpouseBasis(factSet) ||
    hasHumanitarianReturnConcern(factSet);

  push(
    candidate({
      candidate: "possible_bases_multiselect",
      source: "foundational_frame",
      known: basesAlreadyOriented,
      dependency_satisfied: true,
      pathway_discrimination: 0.93,
      jurisdiction_impact: 0.5,
      eligibility_impact: 0.9,
      urgency_impact: 0.5,
      customer_burden: 0.12,
      pre_screen_boost: 0,
      level: 1,
      customer_wording:
        "Which of these apply to you, if any? U.S.-citizen or green-card family member; U.S. employer/job; student/school; afraid or unable to return to your country; victim of crime/abuse/trafficking; U.S. military connection; existing immigration application; none / not sure.",
      reason: "Surfaces immigration bases the customer may not know to mention.",
      fact_needed: "possible_bases_answered",
      branches_affected: ["family", "humanitarian", "employment", "education", "victimization"],
    }),
  );

  // --- L2 activated ---
  if (hasHumanitarianReturnConcern(factSet) || factSet.activated_dimensions.includes("humanitarian")) {
    push(
      candidate({
        candidate: "return_harm_specificity",
        source: "activated_dimension",
        known: isResolved(factSet, "return_harm_specificity"),
        dependency_satisfied: true,
        pathway_discrimination: 0.85,
        jurisdiction_impact: 0.4,
        eligibility_impact: 0.9,
        urgency_impact: 0.55,
        customer_burden: 0.18,
        pre_screen_boost: boostFor(signals, "return_harm_specificity"),
        level: 2,
        customer_wording:
          "What specifically makes you feel you cannot safely return — personal threats/harm, family/group targeting, political opinion, religion/ethnicity/social group, general violence, government/police, or something else?",
        reason: "General country violence and personal targeting for a protected reason can lead to different research tracks.",
        fact_needed: "return_harm_specificity",
        branches_affected: ["humanitarian", "asylum_research", "country_conditions"],
      }),
    );
  }

  if (factSet.activated_dimensions.includes("family") && !hasUscOrLprSpouseBasis(factSet)) {
    push(
      candidate({
        candidate: "family_status_clarify",
        source: "activated_dimension",
        known: hasUscOrLprSpouseBasis(factSet),
        dependency_satisfied: true,
        pathway_discrimination: 0.9,
        jurisdiction_impact: 0.45,
        eligibility_impact: 0.88,
        urgency_impact: 0.4,
        customer_burden: 0.1,
        pre_screen_boost: 0,
        level: 2,
        customer_wording: "Is your spouse (or the relative you mentioned) a U.S. citizen or permanent resident?",
        reason: "Relative status determines whether a family petition basis is present.",
        fact_needed: "family_basis",
        branches_affected: ["family", "i130_research"],
      }),
    );
  }

  if (
    !hasUscOrLprSpouseBasis(factSet) &&
    !factSet.activated_dimensions.includes("family") &&
    !isResolved(factSet, "possible_bases_answered")
  ) {
    // Soft L2 if bases multiselect not yet answered — covered by possible_bases_multiselect
  }

  if (factSet.activated_dimensions.includes("employment")) {
    push(
      candidate({
        candidate: "employer_sponsor_willing",
        source: "activated_dimension",
        known: isResolved(factSet, "employer_sponsor_willing"),
        dependency_satisfied: true,
        pathway_discrimination: 0.8,
        jurisdiction_impact: 0.35,
        eligibility_impact: 0.85,
        urgency_impact: 0.35,
        customer_burden: 0.12,
        pre_screen_boost: 0,
        level: 2,
        customer_wording: "Do you currently have a U.S. employer willing to sponsor you?",
        reason: "Employer willingness is a high-value employment-basis fact.",
        fact_needed: "employer_sponsor_willing",
        branches_affected: ["employment"],
      }),
    );
  }

  // Premature / low-value — must fail the ask gate
  push(
    candidate({
      candidate: "medical_exam",
      source: "foundational_frame",
      known: false,
      dependency_satisfied: true,
      pathway_discrimination: 0.03,
      jurisdiction_impact: 0,
      eligibility_impact: 0.12,
      urgency_impact: 0.05,
      customer_burden: 0.2,
      pre_screen_boost: 0,
      level: 2,
      customer_wording: "Have you completed an immigration medical exam?",
      reason: "May be needed later in some adjustment processes — not for first orientation.",
      fact_needed: "medical_exam_status",
      branches_affected: [],
    }),
  );

  return out;
}

export function rankQuestionCandidates(candidates: QuestionCandidate[]): QuestionCandidate[] {
  return [...candidates].sort((a, b) => {
    // Orientation (L1) before activated (L2) when both clear the ask gate.
    if (a.level !== b.level) return a.level - b.level;
    return scoreQuestionValue(b) - scoreQuestionValue(a);
  });
}

/**
 * Deterministic Question Director — next ask or stop.
 * Phase SI-5: always applies seeded learning hints; optional correction/production hints via opts.
 */
export function runQuestionDirector(
  factSet: SituationFactSet,
  interview: InterviewState,
  opts?: { mockSignals?: PreScreenSignal[]; learningHints?: SituationLearningHints },
): DirectorResult {
  const signals = runLightCountryPreScreen(factSet, { mockSignals: opts?.mockSignals });
  const learning_hints = mergeLearningHints(
    seededSituationLearningHints(factSet),
    opts?.learningHints ?? { suppress_keys: [], prefer_keys: [], negative_lesson_ids: [] },
  );
  const candidates = applyLearningHints(
    buildQuestionCandidates(factSet, signals, interview.asked_candidates),
    learning_hints,
  );
  // Re-evaluate ask gate after learning suppress/prefer
  for (const c of candidates) {
    if (learning_hints.suppress_keys.includes(c.candidate) || /suppressed by negative lesson/i.test(c.reason)) {
      c.ask = false;
      continue;
    }
    const value = scoreQuestionValue(c);
    c.ask = !c.known && c.dependency_satisfied && value >= FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD;
  }
  const ranked = rankQuestionCandidates(candidates);
  const askable = ranked.filter((c) => c.ask && scoreQuestionValue(c) >= FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD);

  const finish = (result: DirectorResult): DirectorResult => {
    recordDirectorTelemetry(factSet, result);
    return result;
  };

  if (interview.asked_count >= MAX_INITIAL_INTERVIEW_QUESTIONS) {
    const stopped: InterviewState = {
      ...interview,
      stopped: true,
      stop_reason: "max_questions",
    };
    return finish({ next: null, ranked, interview: stopped, signals, ready_for_analysis: true, learning_hints });
  }

  if (askable.length === 0) {
    const stopped: InterviewState = {
      ...interview,
      stopped: true,
      stop_reason: interview.asked_count === 0 ? "already_sufficient" : "threshold",
    };
    return finish({ next: null, ranked, interview: stopped, signals, ready_for_analysis: true, learning_hints });
  }

  const next = askable[0]!;
  return finish({
    next,
    ranked,
    interview: { ...interview, stopped: false },
    signals,
    ready_for_analysis: false,
    learning_hints,
  });
}

export function emptyInterviewState(): InterviewState {
  return { asked_count: 0, asked_candidates: [], stopped: false };
}

function upsertFact(
  set: SituationFactSet,
  fact: Omit<SituationFact, "updated_at"> & { updated_at?: string },
): SituationFactSet {
  const facts = set.facts.filter((f) => f.key !== fact.key);
  facts.push({ ...fact, updated_at: fact.updated_at ?? new Date().toISOString() });
  return { ...set, facts };
}

/**
 * Apply a customer answer for a director candidate, then caller re-runs director.
 */
export function applyInterviewAnswer(
  factSet: SituationFactSet,
  interview: InterviewState,
  candidateId: string,
  answer: string,
): { factSet: SituationFactSet; interview: InterviewState } {
  const raw = answer.trim();
  const lower = raw.toLowerCase();
  let nextSet = factSet;

  if (candidateId === "current_location") {
    const inside = /\binside|in the (u\.?s\.?|united states)|yes.*u\.?s/i.test(lower);
    const outside = /\boutside|not in|no\b/i.test(lower) && !inside;
    nextSet = upsertFact(nextSet, {
      key: "current_location",
      value: inside ? "inside_us" : outside ? "outside_us" : raw,
      state: "reported",
      dimension: "where",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "entry_manner") {
    let value = "unsure";
    if (/without|ewi|not inspected|illegally/i.test(lower)) value = "ewi";
    else if (/visa/i.test(lower)) value = "visa";
    else if (/border|processed|released|parole|inspected|admitted/i.test(lower)) value = "inspected_or_paroled";
    else if (/document|status/i.test(lower)) value = "other_document";
    nextSet = upsertFact(nextSet, {
      key: "entry_manner",
      value,
      state: "reported",
      dimension: "immigration_position",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "us_arrival_or_presence_start") {
    nextSet = upsertFact(nextSet, {
      key: "us_arrival_or_presence_start",
      value: raw,
      state: "reported",
      dimension: "immigration_position",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "prior_us_history") {
    nextSet = upsertFact(nextSet, {
      key: "prior_us_history",
      value: raw,
      state: "reported",
      dimension: "immigration_position",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "government_history") {
    const none = /\bno\b|never|none/i.test(lower);
    nextSet = upsertFact(nextSet, {
      key: "prior_filing",
      value: none ? "none_reported" : "something_reported",
      state: "reported",
      dimension: "government_history",
      provenance: "interview",
      source_text: raw,
    });
    nextSet = upsertFact(nextSet, {
      key: "government_history_detail",
      value: raw,
      state: "reported",
      dimension: "government_history",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "possible_bases_multiselect") {
    nextSet = upsertFact(nextSet, {
      key: "possible_bases_answered",
      value: raw,
      state: "reported",
      dimension: "possible_basis",
      provenance: "interview",
      source_text: raw,
    });
    if (/family|spouse|citizen|green.?card|relative/i.test(lower)) {
      nextSet = {
        ...nextSet,
        activated_dimensions: [...new Set([...nextSet.activated_dimensions, "family" as const])],
      };
    }
    if (/afraid|unable to return|cannot return|humanitarian|asylum/i.test(lower)) {
      nextSet = {
        ...nextSet,
        activated_dimensions: [...new Set([...nextSet.activated_dimensions, "humanitarian" as const])],
      };
      nextSet = upsertFact(nextSet, {
        key: "inability_or_concern_about_return",
        value: true,
        state: "reported",
        dimension: "humanitarian",
        provenance: "interview",
        source_text: raw,
      });
    }
    if (/employer|job|work/i.test(lower)) {
      nextSet = {
        ...nextSet,
        activated_dimensions: [...new Set([...nextSet.activated_dimensions, "employment" as const])],
      };
    }
  } else if (candidateId === "return_harm_specificity") {
    nextSet = upsertFact(nextSet, {
      key: "return_harm_specificity",
      value: raw,
      state: "reported",
      dimension: "humanitarian",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "family_status_clarify") {
    const usc = /\bcitizen|usc\b/i.test(lower);
    const lpr = /\bpermanent resident|green.?card|lpr\b/i.test(lower);
    nextSet = upsertFact(nextSet, {
      key: "family_basis",
      value: usc || lpr ? "usc_or_lpr_spouse" : "spouse_mentioned",
      state: "reported",
      dimension: "family",
      provenance: "interview",
      source_text: raw,
    });
  } else if (candidateId === "employer_sponsor_willing") {
    nextSet = upsertFact(nextSet, {
      key: "employer_sponsor_willing",
      value: /\byes\b/i.test(lower),
      state: "reported",
      dimension: "employment",
      provenance: "interview",
      source_text: raw,
    });
  } else {
    nextSet = upsertFact(nextSet, {
      key: candidateId,
      value: raw,
      state: "reported",
      dimension: "other",
      provenance: "interview",
      source_text: raw,
    });
  }

  const nextInterview: InterviewState = {
    asked_count: interview.asked_count + 1,
    asked_candidates: [...interview.asked_candidates, candidateId],
    stopped: false,
  };

  return { factSet: nextSet, interview: nextInterview };
}
