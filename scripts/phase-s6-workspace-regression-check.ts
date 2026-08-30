/**
 * Phase S6 — consolidated workspace regression gate.
 * Canonical Mexico fixture + cross-phase invariants in one place.
 * Run: npx tsx scripts/phase-s6-workspace-regression-check.ts
 * Also: npm run test:phase-s (includes this after S1–S4).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  askableNow,
  assertNoPrematureSchemaAsk,
  composeAssistantReply,
  runConversationIntelligence,
} from "../src/lib/conversation";
import { buildFilingPlanContent } from "../src/lib/filing-plan";
import { decideLegacyCaseDisposition } from "../src/lib/situation-reclassify";
import { MEDICAL_EXAM_NEGATIVE_LESSON } from "../src/lib/experience";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

function assertCanonicalSituation() {
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  assert.equal(intel.intent.interaction_intent, "personal_question");
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.customer_state, "situation");
  assert.equal(intel.route.existing_government_case, false);
  assert.equal(intel.route.invokes_case_engine, false);
  assert.ok(
    intel.route.response_mode === "answer_then_targeted_question" ||
      intel.route.response_mode === "answer_then_targeted_questions",
  );
  assert.equal(intel.question_contract.decision_target, "identify_available_pathways");

  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask);
  assert.match(ask.question, /inspect|parole|admitted|without inspection|border|entry/i);
  assert.ok(assertNoPrematureSchemaAsk(ask, intel.question_contract.decision_target));
  assert.doesNotMatch(ask.question, /medical|i-?693|priority date|passport/i);

  const reply = composeAssistantReply(intel, CANONICAL);
  assert.match(reply, /parole|admitted|inspection|pathway/i);
  assert.doesNotMatch(reply, /medical exam|open a case|YOUR IMMIGRATION CASE/i);

  assert.ok(intel.learning_event.questions_suppressed.includes("medical_exam"));
  assert.ok(
    (intel.experience_record as { negative_lesson_ids?: string[] })?.negative_lesson_ids?.includes(
      MEDICAL_EXAM_NEGATIVE_LESSON.id,
    ),
  );

  // Filing Plan may be built later — still not a Case
  const plan = buildFilingPlanContent({
    pathways: intel.strategy.branches.map((b) => ({ id: b.id, condition: b.condition, explanation: b.explanation })),
    narrative: CANONICAL,
  });
  assert.ok(plan.filings.length >= 1);
  assert.equal(plan.preparationStatus, "draft");

  // Legacy row with this narrative would reclassify to Situation
  const disp = decideLegacyCaseDisposition({
    id: "legacy",
    number: 7,
    title: "options",
    situation: CANONICAL,
    goal: "options",
  });
  assert.equal(disp.action, "reclassify_to_situation");

  return intel;
}

function assertExistingCaseAnswerNotFullReview() {
  const intel = runConversationIntelligence({
    message: "I have pending I-130 receipt MSC2190123456. What does this I-797 mean?",
    documentCount: 1,
    documentHints: ["i797.pdf"],
  });
  assert.equal(intel.route.customer_state, "existing_case");
  assert.equal(intel.route.invokes_case_engine, false);
}

function assertCaseReviewWhenRequested() {
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending I-130/I-485 case receipt MSC2190123456, identify any risks, and tell me what I should do next.",
  });
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.response_mode, "case_review");
}

function assertProductSurfaces() {
  const root = process.cwd();
  const sit = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(sit.includes("Your Immigration Situation"));
  assert.ok(sit.includes("Build my filing plan"));
  assert.doesNotMatch(sit, /YOUR IMMIGRATION CASE/);

  const plan = readFileSync(join(root, "src/components/filing-plan-workspace-view.tsx"), "utf8");
  assert.ok(plan.includes("Filing Plan"));
  assert.ok(/not a Case/i.test(plan));

  const intake = readFileSync(join(root, "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'));

  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model Situation"));
  assert.ok(schema.includes("model FilingPlan"));
  assert.ok(schema.includes("legacyCaseId"));
}

// --- run ---
assertCanonicalSituation();
assertExistingCaseAnswerNotFullReview();
assertCaseReviewWhenRequested();
assertProductSurfaces();

console.log("phase-s6-workspace-regression-check: ok");
