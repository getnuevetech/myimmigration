/**
 * Phase −1.9 L2 — what-mattered partitioning + negative learning records.
 * Run: npx tsx scripts/phase-minus1-9-l2-what-mattered-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { askableNow, runConversationIntelligence } from "../src/lib/conversation";
import {
  MEDICAL_EXAM_NEGATIVE_LESSON,
  buildExperienceRecord,
  buildNegativeLearningRecords,
  deidentifyExperienceRecord,
  extractSituationFeatures,
  hasNegativeLearningViolation,
  isPrematureMedicalExamAsk,
  partitionWhatMattered,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  const features = extractSituationFeatures(CANONICAL);
  assert.ok(features.includes("us_citizen_spouse"), "detect USC spouse");
  assert.ok(features.includes("border_entry"), "detect border entry");
  assert.ok(features.includes("no_prior_filing"), "detect no prior filing");
  assert.ok(features.includes("us_born_child") || features.includes("years_us_presence"), "family/presence features");
}

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  const record = intel.experience_record as ExperienceRecordV0;
  assert.equal(record.schema_version, "l0");
  assert.equal(record.capture_enrichment, "l2");
  assert.ok(record.decision_changing_facts.includes("manner_of_entry"), "manner of entry is decision-changing");
  assert.ok(record.facts_discarded?.includes("medical_exam"), "medical exam discarded");
  assert.ok(record.facts_not_needed_yet.includes("medical_exam"));
  assert.ok(!record.decision_changing_facts.includes("medical_exam"));
  assert.ok(Array.isArray(record.negative_learning_records));
  assert.ok(record.negative_learning_records!.length >= 1);

  const medical = record.negative_learning_records!.find((r) => r.lesson_id === MEDICAL_EXAM_NEGATIVE_LESSON.id);
  assert.ok(medical, "medical negative lesson evaluated");
  assert.equal(medical!.evaluation, "avoided");
  assert.equal(medical!.incorrect_ask_detected, false);
  assert.equal(medical!.preferred_fact_asked, true);
  assert.equal(hasNegativeLearningViolation(record.negative_learning_records!), false);

  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask);
  assert.equal(isPrematureMedicalExamAsk(ask.question), false);
}

{
  // Simulated violation: premature medical exam ask on canonical shape.
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "options" });
  const violated = buildNegativeLearningRecords({
    message: CANONICAL,
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
  assert.equal(violated[0].incorrect_ask_detected, true);
  assert.equal(hasNegativeLearningViolation(violated), true);
}

{
  const partitioned = partitionWhatMattered({
    message: CANONICAL,
    contract: {
      explicit_question: "what are my options?",
      interpreted_question: "what are my options?",
      decision_target: "identify_available_pathways",
      current_scope: "personal_eligibility",
      user_requested_action: false,
      requires_case_development: false,
    },
    askNow: [
      {
        question: "Were you inspected at the border?",
        tier: "critical_now",
        reason: "Determines pathway branch",
        changes_branch: true,
        branches_affected: ["adjustment_of_status"],
      },
    ],
    needToKnow: [
      {
        question: "What is your current employment history?",
        tier: "not_yet",
        reason: "Not required",
        changes_branch: false,
        branches_affected: [],
      },
    ],
  });
  assert.ok(partitioned.decision_changing_facts.includes("manner_of_entry"));
  assert.ok(partitioned.facts_discarded.includes("employment_history"));
  assert.ok(partitioned.facts_discarded.includes("priority_date"));
}

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "options" });
  const record = intel.experience_record as ExperienceRecordV0;
  const anon = deidentifyExperienceRecord(record, { sourceId: "sit_l2" });
  assert.equal(anon.capture_enrichment, "l2");
  assert.ok(anon.facts_discarded.includes("medical_exam"));
  assert.ok(anon.negative_learning.some((n) => n.lesson_id === MEDICAL_EXAM_NEGATIVE_LESSON.id && n.evaluation === "avoided"));
  assert.doesNotMatch(JSON.stringify(anon), /Mexico|wife|daughter|jane@/i);
}

{
  // Non-pathway turn → lesson not applicable.
  const records = buildNegativeLearningRecords({
    message: "What is an I-130?",
    contract: {
      explicit_question: "What is an I-130?",
      interpreted_question: "What is an I-130?",
      decision_target: "explain_general_process",
      current_scope: "general",
      user_requested_action: false,
      requires_case_development: false,
    },
    askNow: [],
  });
  assert.equal(records[0].evaluation, "not_applicable");
}

{
  const rebuilt = buildExperienceRecord({
    contract: {
      explicit_question: "",
      interpreted_question: "options",
      decision_target: "identify_available_pathways",
      current_scope: "personal",
      user_requested_action: false,
      requires_case_development: false,
    },
    workspace: "situation",
    responseMode: "answer_then_targeted_question",
    existingGovernmentCase: false,
    interactionIntent: "personal_question",
    pathways: ["adjustment_of_status"],
    askNow: [],
    message: CANONICAL,
  });
  assert.equal(rebuilt.capture_enrichment, "l2");
  assert.ok(rebuilt.facts_considered.includes("us_citizen_spouse"));
}

{
  const doc = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L2/.test(doc));
  assert.ok(/what-mattered|Decision-changing/i.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9-l2"));
}

console.log("phase-minus1-9-l2-what-mattered-check: ok");
