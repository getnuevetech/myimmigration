/**
 * Phase −1.9 L0 — experience capture + seeded negative lesson.
 * Run: npx tsx scripts/phase-minus1-9-experience-l0-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEDICAL_EXAM_NEGATIVE_LESSON,
  SEEDED_NEGATIVE_LESSONS,
  buildExperienceRecord,
  isPrematureMedicalExamAsk,
} from "../src/lib/experience";
import { askableNow, runConversationIntelligence } from "../src/lib/conversation";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  assert.equal(MEDICAL_EXAM_NEGATIVE_LESSON.id, "NEG-FAM-ENTRY-MEDICAL-001");
  assert.equal(MEDICAL_EXAM_NEGATIVE_LESSON.incorrect_question, "required_medical_exam");
  assert.equal(MEDICAL_EXAM_NEGATIVE_LESSON.preferred_fact, "manner_of_entry");
  assert.ok(SEEDED_NEGATIVE_LESSONS.some((l) => l.id === "NEG-FAM-ENTRY-MEDICAL-001"));
  assert.ok(isPrematureMedicalExamAsk("What can you share about required medical exam?"));
  assert.equal(isPrematureMedicalExamAsk("Were you inspected at the border?"), false);
}

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  const record = intel.experience_record as Record<string, unknown>;
  assert.ok(record, "intelligence must emit experience_record");
  assert.equal(record.schema_version, "l0");
  assert.equal(record.workspace, "situation");
  assert.ok(
    record.decision_target === "identify_available_pathways" ||
      record.decision_target === "identify_possible_pathways",
    "pathways decision target",
  );
  assert.ok(Array.isArray(record.clarifications_suppressed));
  assert.ok((record.clarifications_suppressed as string[]).includes("medical_exam"));
  assert.ok((record.negative_lesson_ids as string[]).includes("NEG-FAM-ENTRY-MEDICAL-001"));
  assert.equal(record.invokes_case_engine, false);
  assert.equal(record.outcome, null);
  assert.ok(record.clarification_selected);

  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask);
  assert.equal(isPrematureMedicalExamAsk(ask.question), false);

  const rebuilt = buildExperienceRecord({
    contract: intel.question_contract,
    workspace: intel.route.workspace,
    responseMode: intel.route.response_mode,
    existingGovernmentCase: false,
    interactionIntent: intel.intent.interaction_intent,
    pathways: intel.strategy.branches.map((b) => b.id),
    askNow: intel.strategy.ask_now,
  });
  assert.equal(rebuilt.schema_version, "l0");
  assert.ok(rebuilt.facts_not_needed_yet.includes("priority_date"));
}

{
  const spec = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(spec.includes("NEG-FAM-ENTRY-MEDICAL-001"));
  assert.ok(/L4 Production/i.test(spec));
  assert.ok(/No live fine-tuning/i.test(spec));
  const s0 = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md"), "utf8");
  assert.ok(/Option B/i.test(s0));
  assert.ok(/S0 LOCKED/i.test(s0));
  assert.ok(!/A \(recommended\).*workspaceKind/i.test(s0));
}

console.log("phase-minus1-9-experience-l0-check: ok");
