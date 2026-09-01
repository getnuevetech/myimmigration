/**
 * Phase SI-5 — corrections / negative lessons → director weights + interview quality capture.
 * Run: npm run test:phase-si-5
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyLearningHints,
  buildInterviewQualityCapture,
  canonicalizeLearningKey,
  emptyInterviewState,
  emptyLearningHints,
  hintsFromConsultantCorrection,
  mergeInterviewQualityIntoLearningJson,
  mergeLearningHints,
  reconcileSituationFacts,
  runQuestionDirector,
  seededSituationLearningHints,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// Key aliases
{
  assert.equal(canonicalizeLearningKey("manner_of_entry"), "entry_manner");
  assert.equal(canonicalizeLearningKey("required_medical_exam"), "medical_exam");
}

// Correction → suppress medical / prefer entry
{
  const hints = hintsFromConsultantCorrection({
    incorrect_key: "required_medical_exam",
    preferred_key: "manner_of_entry",
    lesson_id: "NEG-FAM-ENTRY-MEDICAL-001",
  });
  assert.ok(hints.suppress_keys.includes("medical_exam"));
  assert.ok(hints.prefer_keys.includes("entry_manner"));
  assert.ok(hints.negative_lesson_ids.includes("NEG-FAM-ENTRY-MEDICAL-001"));
}

// Mexico spouse: seeded lesson applies; medical suppressed; entry preferred
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/mexico-spouse.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const seeded = seededSituationLearningHints(set);
  assert.ok(seeded.suppress_keys.includes("medical_exam"));
  assert.ok(seeded.prefer_keys.includes("entry_manner"));
  assert.ok(seeded.negative_lesson_ids.includes("NEG-FAM-ENTRY-MEDICAL-001"));

  const dir = runQuestionDirector(set, emptyInterviewState());
  const medical = dir.ranked.find((c) => c.candidate === "medical_exam");
  assert.ok(medical);
  assert.equal(medical!.ask, false);
  assert.ok(/suppressed by negative lesson/i.test(medical!.reason));

  const entry = dir.ranked.find((c) => c.candidate === "entry_manner");
  if (entry && !entry.known) {
    assert.ok((entry.learning_boost ?? 0) > 0);
    assert.ok(/preferred by institutional learning/i.test(entry.reason));
  }
  assert.ok(dir.learning_hints.suppress_keys.includes("medical_exam"));
}

// Zimbabwe: medical still suppressed; no spouse lesson prefer required
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const dir = runQuestionDirector(set, emptyInterviewState());
  assert.notEqual(dir.next?.candidate, "medical_exam");
  const medical = dir.ranked.find((c) => c.candidate === "medical_exam");
  assert.equal(medical?.ask, false);
}

// Injected correction can suppress an otherwise askable candidate
{
  const set = reconcileSituationFacts("I am from France and want immigration options.", "Options");
  const dir = runQuestionDirector(set, emptyInterviewState());
  assert.equal(dir.next?.candidate, "current_location");

  const suppressed = runQuestionDirector(set, emptyInterviewState(), {
    learningHints: hintsFromConsultantCorrection({
      incorrect_key: "current_location",
      preferred_key: "government_history",
    }),
  });
  assert.notEqual(suppressed.next?.candidate, "current_location");
  const loc = suppressed.ranked.find((c) => c.candidate === "current_location");
  assert.equal(loc?.ask, false);
  const gov = suppressed.ranked.find((c) => c.candidate === "government_history");
  if (gov && !gov.known) {
    assert.ok((gov.learning_boost ?? 0) > 0);
  }
}

// Interview quality capture + merge into learning JSON
{
  const set = reconcileSituationFacts(
    "I came in from Mexico through the border; my wife is a US citizen.",
    "Options",
  );
  const dir = runQuestionDirector(set, emptyInterviewState());
  const capture = buildInterviewQualityCapture({
    asked_candidates: dir.interview.asked_candidates,
    ask_count: dir.interview.asked_count,
    stop_reason: dir.interview.stop_reason,
    ready_for_analysis: dir.ready_for_analysis,
    hints: dir.learning_hints,
    ranked: dir.ranked,
  });
  assert.equal(capture.schema_version, "si-iq-0");
  assert.equal(capture.premature_analysis_forbidden, true);
  assert.ok(capture.suppressed_by_learning.includes("medical_exam"));

  const merged = mergeInterviewQualityIntoLearningJson(
    JSON.stringify({ schema_version: "l0", question_contract: { interpreted_question: "options" } }),
    capture,
  );
  const parsed = JSON.parse(merged);
  assert.equal(parsed.si_interview_quality.schema_version, "si-iq-0");
  assert.ok(parsed.negative_lesson_ids?.length >= 0);
}

// mergeLearningHints union
{
  const m = mergeLearningHints(
    emptyLearningHints(),
    { suppress_keys: ["medical_exam"], prefer_keys: [], negative_lesson_ids: ["A"] },
    { suppress_keys: [], prefer_keys: ["entry_manner"], negative_lesson_ids: ["B"] },
  );
  assert.deepEqual(m.suppress_keys.sort(), ["medical_exam"]);
  assert.deepEqual(m.prefer_keys.sort(), ["entry_manner"]);
  assert.deepEqual(m.negative_lesson_ids.sort(), ["A", "B"]);
}

// Wiring
{
  assert.ok(read("src/lib/situation-intelligence/learning.ts").includes("applyLearningHints"));
  assert.ok(read("src/lib/situation-intelligence/persist-analysis.ts").includes("mergeInterviewQualityIntoLearningJson"));
  assert.ok(read("src/actions/situation-interview.ts").includes("buildInterviewQualityCapture"));
}

console.log("phase-si-5-learning-corrections-check: ok");
