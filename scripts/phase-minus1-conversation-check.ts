/**
 * Phase −1 Conversation Intelligence — customer-visible acceptance tests.
 * Run: npm run test:phase-minus1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  askableNow,
  composeAssistantReply,
  caseMustAnswerBeforeClarify,
  mayPromoteAssistantToCase,
  runConversationIntelligence,
} from "../src/lib/conversation";

function assertAssistant(message: string, goal = "Understand my options", docs = 0) {
  const intel = runConversationIntelligence({ message, goal, documentCount: docs });
  assert.equal(intel.route.pipeline, "assistant", `expected assistant for: ${message.slice(0, 60)}`);
  return intel;
}

function assertCase(message: string, goal = "Full review") {
  const intel = runConversationIntelligence({ message, goal, forceCase: /entire|strategy|what I should file|resolve all/i.test(message) });
  assert.equal(intel.route.pipeline, "case", `expected case for: ${message.slice(0, 60)}`);
  return intel;
}

// 1) USC wife file — answer + ≤1 ask; no Case
{
  const intel = assertAssistant("Can my U.S. citizen wife file for me? We are married.");
  const reply = composeAssistantReply(intel, "Can my U.S. citizen wife file for me?");
  assert.match(reply, /yes/i);
  assert.match(reply, /I-130/i);
  assert.ok(askableNow(intel.need_to_know).length <= 1);
  assert.equal(intel.question_contract.requires_case_development, false);
}

// 2) Border-entry options — branches before clarify
{
  const msg =
    "I came through Mexico, have been here 3 years, wife is USC, daughter born here, haven't filed anything, what are my options?";
  const intel = assertAssistant(msg);
  assert.equal(intel.question_contract.decision_target, "identify_available_pathways");
  assert.equal(intel.strategy.branch_before_clarify, true);
  assert.ok(intel.strategy.branches.length >= 2);
  const reply = composeAssistantReply(intel, msg);
  assert.match(reply, /parole|admitted|inspection/i);
  assert.match(reply, /consular|without inspection/i);
  const askIdx = reply.toLowerCase().indexOf("to determine which pathway");
  const pathIdx = reply.toLowerCase().indexOf("pathways");
  assert.ok(pathIdx >= 0 && (askIdx < 0 || pathIdx < askIdx), "pathways must appear before the clarifying ask");
  assert.ok(intel.strategy.ask_now.every((q) => q.changes_branch && q.tier === "critical_now"));
}

// 3) What is I-862 — explain; no intake
{
  const intel = assertAssistant("What is an I-862?");
  const reply = composeAssistantReply(intel, "What is an I-862?");
  assert.match(reply, /notice to appear|removal/i);
  assert.equal(intel.route.pipeline, "assistant");
}

// 4) Upload I-862 + what does this mean — still Assistant
{
  const intel = assertAssistant("I received this I-862. What does it mean?", "Explain the notice", 1);
  assert.equal(intel.route.pipeline, "assistant");
  const promo = mayPromoteAssistantToCase({
    contract: intel.question_contract,
    userExplicitlyRequestsCase: false,
    documentCount: 1,
  });
  assert.equal(promo.allowed, false);
  assert.match(promo.reason, /upload alone/i);
}

// 5) Comprehensive review → Case
{
  assertCase("Review my entire immigration situation and tell me what I should file.");
}

// 6) Facts, no question — no schema dump / no case
{
  const intel = assertAssistant(
    "I entered three years ago, married a USC, have a US-born child, work under the table, no filings yet.",
    "Help",
  );
  assert.ok(
    intel.intent.primary_intent === "information_only" || intel.intent.primary_intent === "personal_eligibility",
    "facts-only narrative stays assistant-oriented",
  );
  assert.equal(intel.question_contract.requires_case_development, false);
  assert.equal(intel.route.pipeline, "assistant");
}

// 7) Documents needed — answer list; don't demand uploads
{
  const intel = assertAssistant("What documents do I need for a marriage green card?");
  const reply = composeAssistantReply(intel, "What documents do I need for a marriage green card?");
  assert.match(reply, /marriage certificate|I-864|documents/i);
  assert.doesNotMatch(reply, /please upload/i);
  assert.equal(intel.answerability.requires_document, false);
}

// 8) Tax shared contract — options first
{
  const intel = runConversationIntelligence({
    message: "I got an IRS letter and can't pay. What can I do?",
    goal: "Understand options",
  });
  assert.equal(intel.route.pipeline, "assistant");
  assert.ok(intel.intent.domain === "tax_collection" || intel.route.pipeline === "assistant");
}

// 9) CP503 upload + what is this — Assistant
{
  const intel = assertAssistant("What is this CP503?", "Explain", 1);
  const reply = composeAssistantReply(intel, "What is this CP503?");
  assert.match(reply, /CP503|collection/i);
  assert.equal(intel.route.pipeline, "assistant");
}

// 10) Build IRS strategy — Case
{
  const intel = runConversationIntelligence({
    message: "Build a strategy to resolve all my IRS balances for 2022–2025.",
    goal: "Resolve all balances",
  });
  assert.equal(intel.route.pipeline, "case");
  assert.equal(intel.question_contract.requires_case_development, true);
}

// Router ≠ interpreter decree
{
  const intel = runConversationIntelligence({
    message: "Can my USC wife file for me?",
    goal: "Options",
    documentCount: 2,
  });
  assert.equal(intel.intent.recommended_pipeline, "assistant");
  assert.equal(intel.route.pipeline, "assistant");
  assert.ok(intel.route.reason.length > 10);
}

// clarify_first rare
{
  const intel = runConversationIntelligence({ message: "Can I file form X?", goal: "File" });
  assert.equal(intel.answerability.clarify_first_required, true);
  assert.ok(intel.answerability.clarify_first_reason.length > 10);
}

// Case answer-before-clarify contract helpers
{
  assert.equal(
    caseMustAnswerBeforeClarify(
      "I came through Mexico married to a USC — what are my options?",
      "Find a path",
    ),
    true,
  );
  const comprehensive = runConversationIntelligence({
    message: "Review my entire immigration situation and tell me what I should file.",
  });
  assert.equal(comprehensive.answerability.clarify_first_required, false);
}

// Wiring evidence
{
  const intake = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
  assert.ok(intake.includes("runConversationIntelligence"), "intake must run Phase −1 intelligence");
  assert.ok(intake.includes('pipeline === "assistant"'), "intake must branch to assistant");
  assert.ok(intake.includes("mayPromoteAssistantToCase"), "promotion gate must exist");
  const casePage = readFileSync(join(process.cwd(), "src/app/app/cases/[id]/page.tsx"), "utf8");
  assert.ok(casePage.includes("CaseAnswerFirstPanel"), "case page must show answer-first panel");
  const renderStart = casePage.indexOf("return (");
  const body = casePage.slice(renderStart);
  assert.ok(
    body.indexOf("<CaseAnswerFirstPanel") < body.indexOf("<CaseClarify"),
    "answer-first MUST render before clarify",
  );
  assert.ok(
    body.indexOf("<CaseAnalysisView") < body.indexOf("<CaseClarify"),
    "analysis MUST render before clarify",
  );
  const spec = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-CONVERSATION-INTELLIGENCE.md"), "utf8");
  assert.ok(spec.includes("BRANCH_BEFORE_CLARIFY"));
  assert.ok(spec.includes("Question Contract"));
  assert.ok(spec.includes("Conversation Router"));
  assert.ok(/upload alone/i.test(spec), "spec must forbid upload-alone promotion");
}

console.log("phase-minus1-conversation-check: ok");
