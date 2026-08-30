/**
 * Phase −1.9 S8 — Experience regression fixture pack.
 *
 * Consolidated positive/negative isolation fixtures covering capture → de-ID →
 * correction/outcome candidates → production search → telemetry/stale gates.
 * No live fine-tuning. No PII in shared payloads. Outcome ≠ law.
 */

import assert from "node:assert/strict";
import { askableNow, runConversationIntelligence } from "@/lib/conversation";
import {
  applyConsultantCorrection,
  assertIsPatternCandidate,
  buildPatternCandidate,
} from "./corrections";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import type { ExperienceRecordV0 } from "./experience-record";
import { buildNegativeLearningRecords, hasNegativeLearningViolation } from "./negative-learning";
import { MEDICAL_EXAM_NEGATIVE_LESSON, isPrematureMedicalExamAsk } from "./negative-lessons";
import { checkOutcomeAuthority } from "./outcomes";
import { canPromoteToProduction } from "./registry";
import {
  EXPERIENCE_SEARCH_PRECEDENCE,
  assertAllProductionLevel,
  formatExperienceSearchBlock,
  productionPatternAskHints,
  rankProductionPatterns,
} from "./search";
import {
  HARM_AUTO_STALE_MIN,
  filterServableProductionRows,
  isActivelyServable,
  shouldAutoStaleFromTelemetry,
} from "./telemetry";

/** Permanent Phase S / −1.9 canonical narrative. */
export const EXPERIENCE_CANONICAL_NARRATIVE =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

export type ExperienceFixtureKind = "positive" | "negative";

export type ExperiencePackFixture = {
  id: string;
  label: string;
  kind: ExperienceFixtureKind;
  /** Isolation checks run by `runExperienceFixture`. */
  run: () => ExperienceFixtureResult;
};

export type ExperienceFixtureResult = {
  id: string;
  kind: ExperienceFixtureKind;
  notes: string[];
};

function baseProductionPattern(
  over: Partial<AnonymizedExperienceRecord> = {},
): AnonymizedExperienceRecord {
  return {
    schema_version: "l1_anon",
    workspace: "situation",
    decision_target: "identify_available_pathways",
    current_scope: "personal",
    facts_considered: ["us_citizen_spouse", "border_entry", "medical_exam"],
    decision_changing_facts: ["manner_of_entry"],
    facts_not_needed_yet: ["medical_exam", "priority_date"],
    facts_discarded: ["medical_exam", "priority_date"],
    pathways_considered: ["adjustment_of_status", "consular_processing"],
    clarification_key: "manner_of_entry",
    clarification_reason_key: "changes_pathway_branch",
    clarifications_suppressed: ["medical_exam"],
    document_kinds: [],
    authority_ids: [],
    answer_changed_after_clarification: false,
    has_model_correction: false,
    has_reviewer_correction: true,
    outcome_kind: null,
    response_mode: "answer_then_targeted_question",
    invokes_case_engine: false,
    existing_government_case: false,
    interaction_intent: "personal_question",
    negative_lesson_ids: [MEDICAL_EXAM_NEGATIVE_LESSON.id],
    negative_learning: [],
    capture_enrichment: "l2",
    source_digest: "s8prod0001",
    promotion_level: 4,
    origin: "consultant_correction",
    correction: {
      origin: "consultant_correction",
      failure_type: "premature_clarification",
      incorrect_key: "medical_exam",
      preferred_key: "manner_of_entry",
      note_key: "ask_manner_of_entry_first",
      lesson_id: MEDICAL_EXAM_NEGATIVE_LESSON.id,
    },
    ...over,
  };
}

function runCanonicalCapture(): ExperienceFixtureResult {
  const intel = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    goal: "What are my options?",
  });
  const record = intel.experience_record as ExperienceRecordV0;

  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.existing_government_case, false);
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(record.capture_enrichment, "l2");
  assert.ok(record.decision_changing_facts.includes("manner_of_entry"));
  assert.ok(record.facts_discarded?.includes("medical_exam"));

  const medical = record.negative_learning_records?.find(
    (r) => r.lesson_id === MEDICAL_EXAM_NEGATIVE_LESSON.id,
  );
  assert.ok(medical);
  assert.equal(medical!.evaluation, "avoided");
  assert.equal(hasNegativeLearningViolation(record.negative_learning_records || []), false);

  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask);
  assert.equal(isPrematureMedicalExamAsk(ask.question), false);
  assert.doesNotMatch(ask.question, /medical|i-?693|priority date/i);

  const anon = deidentifyExperienceRecord(record, { sourceId: "s8_canonical" });
  assertSafeForSharedExperience(anon);
  assert.doesNotMatch(JSON.stringify(anon), /Mexico|wife|daughter|@|A\d{8}/i);
  assert.equal(canPromoteToProduction(anon).ok, true);

  return {
    id: "exp_canonical_mexico_capture",
    kind: "positive",
    notes: ["situation workspace", "medical exam discarded", "negative lesson avoided"],
  };
}

function runPrematureMedicalViolation(): ExperienceFixtureResult {
  const intel = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    goal: "options",
  });
  const violated = buildNegativeLearningRecords({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    contract: intel.question_contract,
    askNow: [
      {
        question: "Have you completed the required medical exam (I-693)?",
        tier: "critical_now",
        reason: "Schema completeness",
        changes_branch: true,
        branches_affected: [],
      },
    ],
  });
  assert.equal(violated[0].evaluation, "violated");
  assert.equal(hasNegativeLearningViolation(violated), true);
  assert.equal(isPrematureMedicalExamAsk("Have you completed the required medical exam (I-693)?"), true);

  return {
    id: "exp_neg_premature_medical_exam",
    kind: "negative",
    notes: ["premature medical exam ask is a violation"],
  };
}

function runConsultantCorrectionCandidate(): ExperienceFixtureResult {
  const intel = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    goal: "options",
  });
  const record = intel.experience_record as ExperienceRecordV0;
  const flawed: ExperienceRecordV0 = {
    ...record,
    decision_changing_facts: ["medical_exam"],
    facts_discarded: (record.facts_discarded || []).filter((k) => k !== "medical_exam"),
    facts_not_needed_yet: record.facts_not_needed_yet.filter((k) => k !== "medical_exam"),
    reviewer_correction: null,
  };
  const corrected = applyConsultantCorrection(flawed, {
    failure_type: "premature_clarification",
    incorrect_key: "medical_exam",
    preferred_key: "manner_of_entry",
    note_key: "ask_manner_of_entry_first",
  });
  const candidate = buildPatternCandidate(corrected, { sourceId: "s8_correction" });
  assertIsPatternCandidate(candidate);
  assertSafeForSharedExperience(candidate);
  assert.equal(candidate.promotion_level, 1);
  assert.equal(candidate.origin, "consultant_correction");
  assert.equal(candidate.correction?.lesson_id, MEDICAL_EXAM_NEGATIVE_LESSON.id);
  assert.doesNotMatch(JSON.stringify(candidate), /Mexico|wife|@/i);

  return {
    id: "exp_consultant_correction_candidate",
    kind: "positive",
    notes: ["candidate level 1", "links NEG-FAM-ENTRY-MEDICAL-001"],
  };
}

function runOutcomeAuthorityGates(): ExperienceFixtureResult {
  const blocked = checkOutcomeAuthority({
    outcome_kind: "receipt_issued",
    government_system: "uscis",
    form_or_notice_key: "i_130",
    authority_keys: ["msc2190123456"],
    authority_publisher: "USCIS",
    note_key: "receipt_notice_recorded",
  });
  assert.equal(blocked.ok, false);

  const ok = checkOutcomeAuthority({
    outcome_kind: "rfe_issued",
    government_system: "uscis",
    form_or_notice_key: "rfe",
    decision_changing_facts: ["manner_of_entry"],
    authority_keys: ["uscis_policy_manual"],
    authority_publisher: "USCIS",
    note_key: "rfe_after_aos_filing",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.signal_precedence, "historical_experience");
  assert.equal(ok.outranked_by, "current_authority");

  return {
    id: "exp_outcome_authority_gates",
    kind: "positive",
    notes: ["receipt-shaped keys blocked", "Outcome ≠ law"],
  };
}

function runProductionSearchL4Only(): ExperienceFixtureResult {
  const production = baseProductionPattern();
  const other = baseProductionPattern({
    decision_target: "explain_document_or_notice",
    workspace: "question_only",
    source_digest: "s8prod0002",
    negative_lesson_ids: [],
    clarification_key: "notice_identity",
    has_reviewer_correction: false,
    correction: undefined,
  });

  assert.throws(() => assertAllProductionLevel([baseProductionPattern({ promotion_level: 1 })]));
  assert.doesNotThrow(() => assertAllProductionLevel([production]));

  const hits = rankProductionPatterns([production, other], {
    decisionTarget: "identify_available_pathways",
    workspace: "situation",
    factKeys: ["manner_of_entry", "us_citizen_spouse"],
    pathways: ["adjustment_of_status"],
    negativeLessonIds: [MEDICAL_EXAM_NEGATIVE_LESSON.id],
    limit: 5,
  });
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].pattern.decision_target, "identify_available_pathways");

  const block = formatExperienceSearchBlock(hits);
  assert.match(block, /VALIDATED PRODUCTION PATTERNS/);
  assert.match(block, /Outcome ≠ law|not law/i);
  assert.match(EXPERIENCE_SEARCH_PRECEDENCE, /CURRENT AUTHORITY/);

  const hints = productionPatternAskHints(hits);
  assert.ok(hints.suppress_keys.includes("medical_exam"));
  assert.ok(hints.prefer_keys.includes("manner_of_entry"));

  return {
    id: "exp_production_search_l4",
    kind: "positive",
    notes: ["L4-only ranking", "ask hints suppress medical_exam"],
  };
}

function runStaleExcludedFromServe(): ExperienceFixtureResult {
  const rows = filterServableProductionRows([
    { promotionLevel: 4, staleAt: null, anonJson: "{}" },
    { promotionLevel: 4, staleAt: new Date(), anonJson: "{}" },
    { promotionLevel: 1, staleAt: null, anonJson: "{}" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(isActivelyServable({ promotionLevel: 4, staleAt: null }), true);
  assert.equal(isActivelyServable({ promotionLevel: 4, staleAt: new Date() }), false);

  return {
    id: "exp_stale_excluded_from_serve",
    kind: "negative",
    notes: ["stale and non-production rows not servable"],
  };
}

function runTelemetryAutoStale(): ExperienceFixtureResult {
  assert.equal(shouldAutoStaleFromTelemetry(0, 2), false);
  assert.equal(shouldAutoStaleFromTelemetry(0, HARM_AUTO_STALE_MIN), true);
  assert.equal(shouldAutoStaleFromTelemetry(3, 6), true);
  assert.equal(shouldAutoStaleFromTelemetry(10, 3), false);

  return {
    id: "exp_telemetry_auto_stale",
    kind: "positive",
    notes: [`auto-stale at harm>=${HARM_AUTO_STALE_MIN} and harm>=help*2`],
  };
}

function runNonProductionRefusedInBlock(): ExperienceFixtureResult {
  assert.throws(() =>
    formatExperienceSearchBlock([
      {
        pattern: baseProductionPattern({ promotion_level: 2 }),
        score: 1,
        match_reasons: ["x"],
      },
    ]),
  );
  assert.equal(formatExperienceSearchBlock([]), "");

  return {
    id: "exp_neg_non_production_prompt_block",
    kind: "negative",
    notes: ["prompt formatter refuses levels below 4"],
  };
}

/** Full Experience regression pack (~8 fixtures). */
export const EXPERIENCE_FIXTURE_PACK: ExperiencePackFixture[] = [
  {
    id: "exp_canonical_mexico_capture",
    label: "Canonical Mexico / USC-spouse options → Situation capture",
    kind: "positive",
    run: runCanonicalCapture,
  },
  {
    id: "exp_neg_premature_medical_exam",
    label: "Premature medical-exam ask violates negative lesson",
    kind: "negative",
    run: runPrematureMedicalViolation,
  },
  {
    id: "exp_consultant_correction_candidate",
    label: "Consultant correction → level-1 pattern candidate",
    kind: "positive",
    run: runConsultantCorrectionCandidate,
  },
  {
    id: "exp_outcome_authority_gates",
    label: "Government outcome authority gates (receipt blocked)",
    kind: "positive",
    run: runOutcomeAuthorityGates,
  },
  {
    id: "exp_production_search_l4",
    label: "Experience Search ranks L4 production patterns only",
    kind: "positive",
    run: runProductionSearchL4Only,
  },
  {
    id: "exp_stale_excluded_from_serve",
    label: "Stale / non-production patterns excluded from serve",
    kind: "negative",
    run: runStaleExcludedFromServe,
  },
  {
    id: "exp_telemetry_auto_stale",
    label: "Telemetry harm threshold auto-stales",
    kind: "positive",
    run: runTelemetryAutoStale,
  },
  {
    id: "exp_neg_non_production_prompt_block",
    label: "Prompt block refuses non-production patterns",
    kind: "negative",
    run: runNonProductionRefusedInBlock,
  },
];

export function listExperienceFixtureIds(): string[] {
  return EXPERIENCE_FIXTURE_PACK.map((f) => f.id);
}

export function runExperienceFixture(id: string): ExperienceFixtureResult {
  const fixture = EXPERIENCE_FIXTURE_PACK.find((f) => f.id === id);
  if (!fixture) throw new Error(`unknown experience fixture: ${id}`);
  const result = fixture.run();
  assert.equal(result.id, fixture.id);
  assert.equal(result.kind, fixture.kind);
  return result;
}

export function runExperienceFixturePack(): ExperienceFixtureResult[] {
  return EXPERIENCE_FIXTURE_PACK.map((f) => runExperienceFixture(f.id));
}
