/**
 * Phase −1.9 L6 — Experience Search into Sol (production / level 4 only).
 * Run: npx tsx scripts/phase-minus1-9-l6-experience-search-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPERIENCE_SEARCH_PRECEDENCE,
  assertAllProductionLevel,
  formatExperienceSearchBlock,
  productionPatternAskHints,
  rankProductionPatterns,
  type AnonymizedExperienceRecord,
} from "../src/lib/experience";

function basePattern(over: Partial<AnonymizedExperienceRecord> = {}): AnonymizedExperienceRecord {
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
    negative_lesson_ids: ["NEG-FAM-ENTRY-MEDICAL-001"],
    negative_learning: [],
    capture_enrichment: "l2",
    source_digest: "dtest0001",
    promotion_level: 4,
    origin: "consultant_correction",
    correction: {
      origin: "consultant_correction",
      failure_type: "premature_clarification",
      incorrect_key: "medical_exam",
      preferred_key: "manner_of_entry",
      note_key: "ask_manner_of_entry_first",
      lesson_id: "NEG-FAM-ENTRY-MEDICAL-001",
    },
    ...over,
  };
}

{
  assert.match(EXPERIENCE_SEARCH_PRECEDENCE, /CURRENT AUTHORITY/);
  assert.match(EXPERIENCE_SEARCH_PRECEDENCE, /VALIDATED PRODUCTION PATTERN/);
}

{
  assert.throws(() => assertAllProductionLevel([basePattern({ promotion_level: 1 })]));
  assert.doesNotThrow(() => assertAllProductionLevel([basePattern()]));
}

{
  const production = basePattern();
  const other = basePattern({
    decision_target: "explain_document_or_notice",
    workspace: "question_only",
    decision_changing_facts: ["notice_identity"],
    facts_discarded: [],
    negative_lesson_ids: [],
    clarification_key: "notice_identity",
    source_digest: "dtest0002",
    has_reviewer_correction: false,
    correction: undefined,
    origin: "turn",
  });

  const hits = rankProductionPatterns([production, other], {
    decisionTarget: "identify_available_pathways",
    workspace: "situation",
    factKeys: ["manner_of_entry", "us_citizen_spouse"],
    pathways: ["adjustment_of_status"],
    negativeLessonIds: ["NEG-FAM-ENTRY-MEDICAL-001"],
    limit: 5,
  });

  assert.ok(hits.length >= 1);
  assert.equal(hits[0].pattern.decision_target, "identify_available_pathways");
  assert.ok(hits[0].score > 0);
  assert.ok(hits[0].match_reasons.includes("decision_target"));

  const block = formatExperienceSearchBlock(hits);
  assert.match(block, /VALIDATED PRODUCTION PATTERNS/);
  assert.match(block, /Outcome ≠ law|not law/i);
  assert.match(block, /manner_of_entry/);
  assert.match(block, /medical_exam/);
  assert.match(block, /NEG-FAM-ENTRY-MEDICAL-001/);
  assert.doesNotMatch(block, /@|A\d{8}|MSC\d+/i);

  const hints = productionPatternAskHints(hits);
  assert.ok(hints.suppress_keys.includes("medical_exam"));
  assert.ok(hints.prefer_keys.includes("manner_of_entry"));
  assert.ok(hints.negative_lesson_ids.includes("NEG-FAM-ENTRY-MEDICAL-001"));
}

{
  assert.equal(formatExperienceSearchBlock([]), "");
  assert.throws(() =>
    formatExperienceSearchBlock([
      {
        pattern: basePattern({ promotion_level: 2 }),
        score: 1,
        match_reasons: ["x"],
      },
    ]),
  );
}

{
  const root = process.cwd();
  const search = readFileSync(join(root, "src/lib/experience/search.ts"), "utf8");
  assert.ok(search.includes("listProductionPatterns"));
  assert.ok(search.includes("promotion_level !== 4"));
  assert.ok(/No live fine-tuning/i.test(search));

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.ok(orch.includes("buildExperienceSearchBlock"));

  const intel = readFileSync(join(root, "src/lib/conversation/intelligence.ts"), "utf8");
  assert.ok(intel.includes("buildExperienceSearchBlock"));
  assert.ok(intel.includes("EXPERIENCE_PATTERNS") || intel.includes("experienceBlock"));

  const pub = readFileSync(join(root, "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("minPromotionLevel: 4"));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L6/.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9-l6"));
  assert.ok(/Experience Search/i.test(doc));
}

console.log("phase-minus1-9-l6-experience-search-check: ok");
