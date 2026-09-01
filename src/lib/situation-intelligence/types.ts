/**
 * Phase SI — Situation Intelligence contracts (Phase 0).
 * Facts vs legal conclusions stay separated.
 */

export const SITUATION_FACT_STATES = [
  "reported",
  "verified",
  "derived",
  "unknown",
  "conflicted",
] as const;
export type SituationFactState = (typeof SITUATION_FACT_STATES)[number];

export const FOUNDATIONAL_DIMENSIONS = [
  "who_origin",
  "where",
  "immigration_position",
  "government_history",
  "possible_basis",
  "goal",
] as const;
export type FoundationalDimension = (typeof FOUNDATIONAL_DIMENSIONS)[number];

export const ACTIVATED_DIMENSIONS = [
  "humanitarian",
  "family",
  "employment",
  "education",
  "victimization",
  "abuse",
  "trafficking",
  "court_removal",
  "prior_violations",
  "citizenship",
  "military",
  "investment",
  "country_program",
] as const;
export type ActivatedDimension = (typeof ACTIVATED_DIMENSIONS)[number];

export type SituationFactProvenance =
  | "user_narrative"
  | "interview"
  | "document"
  | "ai1_decompose"
  | "ai2_audit"
  | "reconciler"
  | "pre_screen";

export type SituationFact = {
  key: string;
  value: string | boolean | number | null;
  state: SituationFactState;
  dimension: FoundationalDimension | ActivatedDimension | "other";
  provenance: SituationFactProvenance;
  source_text?: string;
  document_id?: string;
  updated_at: string;
};

export type SituationFactSet = {
  schema_version: "si-0" | "si-1";
  facts: SituationFact[];
  activated_dimensions: ActivatedDimension[];
  unresolved_foundational: FoundationalDimension[];
  /** Phase SI-2 iterative interview progress */
  interview?: {
    asked_count: number;
    asked_candidates: string[];
    stopped: boolean;
    stop_reason?: string;
  };
};

/** Light pre-screen signal (Phase 2 consumes; contract locked in Phase 0). */
export type PreScreenSignal = {
  signal_type: string;
  country?: string;
  cue: string;
  date_hint?: string;
  authority_refs: string[];
  elevates_fact: string;
  confidence: number;
};

export const FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD = 0.55;
export const MAX_INITIAL_INTERVIEW_QUESTIONS = 6;
export const TARGET_INTERVIEW_QUESTIONS_MIN = 3;
export const TARGET_INTERVIEW_QUESTIONS_MAX = 5;

export type QuestionCandidate = {
  candidate: string;
  source: "foundational_frame" | "activated_dimension" | "pre_screen";
  known: boolean;
  dependency_satisfied: boolean;
  pathway_discrimination: number;
  jurisdiction_impact: number;
  eligibility_impact: number;
  urgency_impact: number;
  customer_burden: number;
  pre_screen_boost: number;
  /** Phase SI-5 — boost from corrections / negative lessons (prefer_keys). */
  learning_boost?: number;
  ask: boolean;
  level: 1 | 2;
  customer_wording: string;
  reason: string;
  fact_needed: string;
  branches_affected: string[];
};

/** Consultant brief visual buckets (Phase 4; contract locked). */
export type SituationBriefBuckets = {
  reported_facts: SituationFact[];
  verified_facts: SituationFact[];
  ai_findings: string[];
  unresolved: string[];
};

export const SI_TELEMETRY = {
  fullPersonalizedAnalysisBeforeFactOrientation: "full_personalized_analysis_before_fact_orientation",
  interviewAskCount: "situation_intelligence_interview_ask_count",
  skipAsResolved: "situation_intelligence_skip_as_resolved",
  preScreenBoost: "situation_intelligence_pre_screen_boost",
  learningBoost: "situation_intelligence_learning_boost",
  learningSuppress: "situation_intelligence_learning_suppress",
  interviewQualityCaptured: "situation_intelligence_interview_quality_captured",
} as const;

export type DecomposeClaim = {
  key: string;
  value: string | boolean | number | null;
  dimension: FoundationalDimension | ActivatedDimension | "other";
  source_text: string;
  confidence: number;
  /** AI1 may flag soft claims that must not become hard facts without audit. */
  claim_strength: "explicit" | "soft" | "ambiguous";
};

export type DecomposeResult = {
  claims: DecomposeClaim[];
  activated_dimensions: ActivatedDimension[];
  notes: string[];
};

export type AuditFinding = {
  key: string;
  action: "keep" | "downgrade" | "drop" | "add_unknown" | "conflict";
  reason: string;
  revised_value?: string | boolean | number | null;
  revised_strength?: "explicit" | "soft" | "ambiguous";
};
