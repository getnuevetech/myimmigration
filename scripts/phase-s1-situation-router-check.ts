/**
 * Phase S1 — workspace axes + response_mode depth + canonical Mexico fixture.
 * Run: npx tsx scripts/phase-s1-situation-router-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  askableNow,
  assertNoPrematureSchemaAsk,
  composeAssistantReply,
  detectGovernmentMatter,
  mayPromoteAssistantToCase,
  runConversationIntelligence,
} from "../src/lib/conversation";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

// Canonical S0 fixture
{
  const intel = runConversationIntelligence({
    message: CANONICAL,
    goal: "What are my options?",
  });
  assert.equal(intel.intent.interaction_intent, "personal_question");
  assert.equal(intel.route.customer_state, "situation");
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.existing_government_case, false);
  assert.equal(intel.intent.recommended_workspace, "situation");
  assert.ok(
    intel.route.response_mode === "answer_then_targeted_question" ||
      intel.route.response_mode === "answer_then_targeted_questions",
  );
  assert.equal(intel.question_contract.decision_target, "identify_available_pathways");
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.pipeline, "assistant");
  assert.notEqual(intel.route.workspace, "existing_case");

  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask, "must ask one decision-changing question");
  assert.match(ask.question, /inspect|parole|admitted|without inspection|border|entry/i);
  assert.ok(assertNoPrematureSchemaAsk(ask, intel.question_contract.decision_target));
  assert.doesNotMatch(ask.question, /medical|i-?693|priority date|passport/i);

  const reply = composeAssistantReply(intel, CANONICAL);
  assert.match(reply, /parole|admitted|inspection|pathway/i);
  assert.doesNotMatch(reply, /medical exam|priority date|open a case/i);
  assert.ok(intel.learning_event.questions_suppressed.includes("medical_exam"));
  assert.equal(intel.learning_event.invokes_case_engine, false);
  assert.equal(intel.learning_event.workspace_selected, "situation");
}

// existing_case + document question → answer, NOT case engine
{
  const intel = runConversationIntelligence({
    message: "I have a pending I-130 (receipt MSC2190123456). What does this I-797 notice mean?",
    goal: "Explain the notice",
    documentCount: 1,
    documentHints: ["i797.pdf"],
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.customer_state, "existing_case");
  assert.equal(intel.route.invokes_case_engine, false);
  assert.ok(
    intel.route.response_mode === "answer" || intel.route.response_mode === "answer_then_targeted_question",
  );
}

// existing_case + full strategy → case_review
{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending I-130/I-485 case (receipt MSC2190123456), identify any risks, and tell me what I should do next.",
    goal: "Full strategy",
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.customer_state, "existing_case");
  assert.equal(intel.route.response_mode, "case_review");
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.pipeline, "case");
}

// Comprehensive unfiled strategy → Situation, not Case engine
{
  const intel = runConversationIntelligence({
    message: "Review my entire immigration situation and tell me what I should file.",
    goal: "Full review",
  });
  assert.equal(intel.route.existing_government_case, false);
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.workspace, "situation");
}

// Upload I-797 alone for "what is it?" → not case_review
{
  const intel = runConversationIntelligence({
    message: "I found this old I-797 in my files. What is it?",
    goal: "Explain",
    documentCount: 1,
    documentHints: ["i-797.pdf"],
  });
  assert.equal(intel.route.invokes_case_engine, false);
}

// Government matter detection + promotion gate
{
  assert.equal(detectGovernmentMatter("yet to file for any document").existing_government_case, false);
  assert.equal(detectGovernmentMatter("My I-130 was filed and I got receipt MSC123").existing_government_case, true);
  const promo = mayPromoteAssistantToCase({
    contract: runConversationIntelligence({ message: CANONICAL }).question_contract,
    userExplicitlyRequestsCase: true,
    existingGovernmentCase: false,
  });
  assert.equal(promo.allowed, false);
}

// Customer forceCase removed from intake UI
{
  const intake = readFileSync(join(process.cwd(), "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'), "customer intake must not expose forceCase");
  const newCase = readFileSync(join(process.cwd(), "src/app/app/cases/new/page.tsx"), "utf8");
  assert.ok(!newCase.includes('name="forceCase"'), "new case form must not expose forceCase");
  const actions = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
  assert.ok(actions.includes("invokes_case_engine"), "intake must branch on invokes_case_engine");
  assert.ok(actions.includes("createSituationFromIntelligence") || actions.includes("situations/"), "intake must create Situation");
}

// Spec lock
{
  const spec = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md"), "utf8");
  assert.ok(/S0 APPROVED/i.test(spec));
  assert.ok(/Workspace state never determines analysis depth/i.test(spec));
  assert.ok(/Option B/i.test(spec));
  assert.ok(/Response mode controls engine invocation/i.test(spec));
}

console.log("phase-s1-situation-router-check: ok");
