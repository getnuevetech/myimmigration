/**
 * Phase −1.8 Pipeline A UX polish — acceptance checks.
 * Run: tsx scripts/phase-minus1-8-pipeline-a-ux-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composeAssistantReply,
  composeAssistantView,
  decisionFocusLabel,
  runConversationIntelligence,
} from "../src/lib/conversation";

const root = join(__dirname, "..");
function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// 1) Structured view has branches + ask; plain reply has no markdown markers
{
  const msg =
    "I came through Mexico, have been here 3 years, wife is USC, daughter born here, haven't filed anything, what are my options?";
  const intel = runConversationIntelligence({ message: msg, goal: "Understand my options" });
  const view = composeAssistantView(intel, msg);
  assert.ok(view.some((s) => s.type === "branches"), "view must include branches");
  assert.ok(view.some((s) => s.type === "ask"), "view must include critical ask");
  assert.ok(view.some((s) => s.type === "disclaimer"), "view must include disclaimer");
  const reply = composeAssistantReply(intel, msg);
  assert.equal(/\*\*/.test(reply), false, "reply must not use markdown bold");
  assert.equal(/_\(Why/.test(reply), false, "reply must not use markdown italics");
  assert.match(reply, /Pathways that usually matter/i);
  assert.match(reply, /Why this matters/i);
}

// 2) Focus labels
{
  assert.equal(decisionFocusLabel("identify_available_pathways"), "Which pathways may be available");
  assert.equal(decisionFocusLabel("petition_eligibility_overview"), "Whether a relative can file for you");
}

// 3) Wiring
{
  const composer = read("src/lib/conversation/assistant-composer.ts");
  assert.ok(composer.includes("composeAssistantView"), "composer must export structured view");

  const casePanel = read("src/components/case-answer-first.tsx");
  assert.ok(casePanel.includes("AssistantReplyBlocks"), "case answer-first must use structured blocks");

  const qa = read("src/components/qa-chat.tsx");
  assert.ok(qa.includes("STARTER_PROMPTS"), "qa empty state must use Phase −1 starters");
  assert.ok(
    qa.includes("Continue with my situation") || qa.includes("Start a full case review"),
    "qa must offer Situation/Case continue CTA",
  );
  assert.ok(qa.includes("Working on") || qa.includes("focusLabel"), "qa must show decision focus chrome");
  assert.ok(qa.includes("defaultQuestion"), "qa must support guide prefill");

  const guide = read("src/lib/guide.ts");
  assert.ok(guide.includes("/app/qa?q="), "guide must hand off with q= prefill");

  const listPage = read("src/app/app/qa/page.tsx");
  assert.ok(listPage.includes("defaultQuestion"), "qa index must accept q prefill");

  const threadPage = read("src/app/app/qa/[id]/page.tsx");
  assert.ok(threadPage.includes("decisionFocusLabel"), "thread page must pass focus label");
  assert.ok(threadPage.includes("parseStoredIntelligence"), "thread page must read intelligence");
}

console.log("phase-minus1-8-pipeline-a-ux-check: ok");
