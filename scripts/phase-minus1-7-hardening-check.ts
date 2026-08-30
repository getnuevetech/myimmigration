/**
 * Phase −1.7 Assistant hardening — acceptance checks.
 * Run: tsx scripts/phase-minus1-7-hardening-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mergeWithPrior,
  needToKnowClarifyQuestion,
  priorContractFromStored,
  runConversationIntelligence,
  unknownHelpsContract,
} from "../src/lib/conversation";
import { emptyQuestionContract } from "../src/lib/conversation/types";

const root = join(__dirname, "..");

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// 1) Question Contract continuity across turns
{
  const first = runConversationIntelligence({
    message: "Can my U.S. citizen wife file for me? We are married.",
  });
  assert.equal(first.question_contract.decision_target, "petition_eligibility_overview");

  const followUp = runConversationIntelligence({
    message: "She got her passport last year.",
    priorContract: first.question_contract,
  });
  assert.equal(
    followUp.question_contract.decision_target,
    "petition_eligibility_overview",
    "follow-up must keep prior decision_target",
  );

  const stored = priorContractFromStored(JSON.stringify(first));
  assert.equal(stored?.decision_target, "petition_eligibility_overview");

  const merged = mergeWithPrior(first.question_contract, {
    ...emptyQuestionContract(),
    decision_target: "answer_user_question",
    explicit_question: "yes",
    interpreted_question: "yes",
  });
  assert.equal(merged.decision_target, "petition_eligibility_overview");
}

// 2) Comprehensive still overrides continuity (unfiled → Situation, not Case engine)
{
  const prior = runConversationIntelligence({
    message: "What is an I-862?",
  }).question_contract;
  const next = runConversationIntelligence({
    message: "Review my entire immigration situation and tell me what I should file.",
    priorContract: prior,
  });
  assert.equal(next.question_contract.decision_target, "comprehensive_case_strategy");
  assert.equal(next.route.invokes_case_engine, false);
  assert.equal(next.route.workspace, "situation");
  const filed = runConversationIntelligence({
    message: "Review my entire pending I-130 case receipt MSC2190123456 and tell me what to do.",
    priorContract: prior,
  });
  assert.equal(filed.route.invokes_case_engine, true);
  assert.equal(filed.route.pipeline, "case");
}

// 3) Need-to-know clarify prefers critical branch-changing asks
{
  const intel = runConversationIntelligence({
    message:
      "I came through Mexico, have been here 3 years, wife is USC, daughter born here, haven't filed anything, what are my options?",
  });
  const ntk = needToKnowClarifyQuestion(intel, []);
  assert.ok(ntk, "expected a need-to-know clarify question");
  assert.equal(ntk!.tier, "critical_now");
  assert.equal(ntk!.changes_branch, true);
  assert.ok(unknownHelpsContract("entry_manner", intel));
  assert.equal(unknownHelpsContract("favorite_color_unrelated_xyz", intel), false);
}

// 4) Wiring: askQuestion uses prior + enrich; guide uses router; admin shows snapshot
{
  const user = read("src/actions/user.ts");
  assert.ok(user.includes("priorContractFromStored"), "askQuestion must load prior contract");
  assert.ok(user.includes("enrichIntelligenceWithReasoningModel"), "askQuestion must enrich via Sol when low confidence");

  const guide = read("src/lib/guide.ts");
  assert.ok(guide.includes("runConversationIntelligence"), "guide must run Conversation Router");
  assert.ok(guide.includes("/app/qa"), "guide must hand off questions to Assistant");
  assert.ok(guide.includes("invokes_case_engine") || guide.includes("Track this government case"), "guide must hand off government Case via response_mode");

  const clarify = read("src/lib/clarify.ts");
  assert.ok(clarify.includes("needToKnowClarifyQuestion"), "clarify must prefer need-to-know");

  const planner = read("src/lib/question-planner.ts");
  assert.ok(planner.includes("unknownHelpsContract"), "planner must filter by decision target");

  const admin = read("src/app/admin/cases/[id]/page.tsx");
  assert.ok(admin.includes("parseStoredIntelligence"), "admin must show intelligence diagnostics");
  assert.ok(admin.includes("decision_target"), "admin diagnostics must show decision target");

  const spec = read("docs/v5.1/PHASE-MINUS1-7-ASSISTANT-HARDENING.md");
  assert.ok(spec.includes("PRIOR_CONTRACT") || spec.includes("priorContract") || spec.includes("continuity"));

  const casesNew = read("src/app/app/cases/new/page.tsx");
  assert.ok(!casesNew.includes('name="forceCase"'), "cases/new must not expose customer forceCase");
  assert.ok(casesNew.includes("createCaseAction"), "cases/new still posts intake");
}

console.log("phase-minus1-7-hardening-check: ok");
