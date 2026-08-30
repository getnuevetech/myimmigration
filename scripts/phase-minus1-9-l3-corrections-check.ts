/**
 * Phase −1.9 L3 — consultant corrections → pattern candidates.
 * Run: npx tsx scripts/phase-minus1-9-l3-corrections-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  MEDICAL_EXAM_NEGATIVE_LESSON,
  PATTERN_CANDIDATE_LEVEL,
  applyConsultantCorrection,
  assertIsPatternCandidate,
  assertSafeForSharedExperience,
  buildPatternCandidate,
  deidentifyExperienceRecord,
  inferLessonId,
  isInstitutionalKey,
  listProductionPatterns,
  normalizeCorrectionInput,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  assert.equal(isInstitutionalKey("manner_of_entry"), true);
  assert.equal(isInstitutionalKey("Medical Exam!"), false);
  assert.equal(isInstitutionalKey("a"), false);
  assert.throws(() =>
    normalizeCorrectionInput({
      failure_type: "premature_clarification",
      incorrect_key: "Jane Doe medical",
      preferred_key: "manner_of_entry",
      note_key: "ask_entry_first",
    }),
  );
}

{
  const correction = normalizeCorrectionInput({
    failure_type: "premature_clarification",
    incorrect_key: "medical_exam",
    preferred_key: "manner_of_entry",
    note_key: "ask_manner_of_entry_first",
  });
  assert.equal(inferLessonId(correction), MEDICAL_EXAM_NEGATIVE_LESSON.id);
}

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "options" });
  const record = intel.experience_record as ExperienceRecordV0;
  assert.equal(record.capture_enrichment, "l2");

  // Simulate a turn that wrongly treated medical exam as decision-changing.
  const flawed: ExperienceRecordV0 = {
    ...record,
    decision_changing_facts: ["medical_exam"],
    facts_discarded: record.facts_discarded?.filter((k) => k !== "medical_exam") ?? [],
    facts_not_needed_yet: record.facts_not_needed_yet.filter((k) => k !== "medical_exam"),
    reviewer_correction: null,
  };

  const corrected = applyConsultantCorrection(flawed, {
    failure_type: "premature_clarification",
    incorrect_key: "medical_exam",
    preferred_key: "manner_of_entry",
    note_key: "ask_manner_of_entry_first",
  });

  assert.ok(corrected.reviewer_correction);
  assert.equal(corrected.reviewer_correction!.origin, "consultant_correction");
  assert.equal(corrected.reviewer_correction!.incorrect_key, "medical_exam");
  assert.equal(corrected.reviewer_correction!.preferred_key, "manner_of_entry");
  assert.equal(corrected.reviewer_correction!.lesson_id, MEDICAL_EXAM_NEGATIVE_LESSON.id);
  assert.ok(corrected.decision_changing_facts.includes("manner_of_entry"));
  assert.ok(!corrected.decision_changing_facts.includes("medical_exam"));
  assert.ok(corrected.facts_discarded?.includes("medical_exam"));
  assert.ok(corrected.negative_lesson_ids.includes(MEDICAL_EXAM_NEGATIVE_LESSON.id));

  const candidate = buildPatternCandidate(corrected, { sourceId: "sit_l3_test" });
  assert.equal(candidate.promotion_level, PATTERN_CANDIDATE_LEVEL);
  assert.equal(candidate.promotion_level, 1);
  assert.equal(candidate.origin, "consultant_correction");
  assert.ok(candidate.correction);
  assert.equal(candidate.correction!.incorrect_key, "medical_exam");
  assert.equal(candidate.correction!.preferred_key, "manner_of_entry");
  assert.equal(candidate.correction!.lesson_id, MEDICAL_EXAM_NEGATIVE_LESSON.id);
  assert.equal(candidate.has_reviewer_correction, true);
  assertIsPatternCandidate(candidate);
  assertSafeForSharedExperience(candidate);
  assert.doesNotMatch(JSON.stringify(candidate), /Mexico|wife|daughter|@|A\d{8}/i);

  // Ordinary turn anon stays at level 0 / turn origin.
  const turnAnon = deidentifyExperienceRecord(record, { sourceId: "sit_turn" });
  assert.equal(turnAnon.promotion_level, 0);
  assert.equal(turnAnon.origin, "turn");
}

{
  assert.throws(() =>
    buildPatternCandidate({
      ...(runConversationIntelligence({ message: CANONICAL }).experience_record as ExperienceRecordV0),
      reviewer_correction: null,
    }),
  );
}

{
  // Guard: L3 helpers must not claim production retrieval.
  const pub = readFileSync(join(process.cwd(), "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("listPatternCandidates"));
  assert.ok(pub.includes("publishPatternCandidateFromCorrection"));
  assert.ok(pub.includes("minPromotionLevel: 4"));
  assert.ok(pub.includes("promotionLevel: 1"));
  // listProductionPatterns still exists and is L4-only (signature check via import).
  assert.equal(typeof listProductionPatterns, "function");
}

{
  const action = readFileSync(join(process.cwd(), "src/actions/experience-correction.ts"), "utf8");
  assert.ok(action.includes("recordConsultantExperienceCorrectionAction"));
  assert.ok(action.includes("ROLES.CONSULTANT"));
  assert.ok(!/fine-?tun/i.test(action));
}

{
  const doc = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L3/.test(doc));
  assert.ok(/pattern candidate/i.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9-l3"));
  assert.ok(/promotion level\s*\*?\*?1/i.test(doc) || doc.includes("promotion_level 1") || doc.includes("promotion level **1**"));
}

console.log("phase-minus1-9-l3-corrections-check: ok");
