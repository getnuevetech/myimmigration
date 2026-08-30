/**
 * Phase S4 — Case = government matter only; legacy reclassify rules.
 * Run: npx tsx scripts/phase-s4-case-lifecycle-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import { decideLegacyCaseDisposition } from "../src/lib/situation-reclassify";

const OPTIONS =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

// Live routing: options → Situation, not Case engine
{
  const intel = runConversationIntelligence({ message: OPTIONS, goal: "options" });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.existing_government_case, false);
}

// Pending I-130 strategy → Case engine
{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending I-130/I-485 case receipt MSC2190123456, identify risks, and tell me what I should do next.",
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.workspace, "existing_case");
}

// Notice explain with receipt → existing_case workspace but NOT case engine
{
  const intel = runConversationIntelligence({
    message: "I got I-797 receipt MSC2190123456. What does this notice mean?",
    documentCount: 1,
    documentHints: ["i797.pdf"],
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.invokes_case_engine, false);
}

// Legacy disposition: options narrative → Situation
{
  const d = decideLegacyCaseDisposition({
    id: "c1",
    number: 7,
    title: "options",
    situation: OPTIONS,
    goal: "What are my options?",
  });
  assert.equal(d.action, "reclassify_to_situation");
}

// Legacy disposition: receipt case → keep Case
{
  const d = decideLegacyCaseDisposition({
    id: "c2",
    number: 8,
    title: "I-130 pending",
    situation: "My wife filed I-130. Receipt MSC2190123456. Status pending.",
    goal: "Track my case",
    notices: [{ noticeType: "I-797" }],
  });
  assert.equal(d.action, "keep_case");
  assert.ok(d.governmentSystems.includes("uscis"));
}

// Uncertain with no signals → Situation (default)
{
  const d = decideLegacyCaseDisposition({
    id: "c3",
    number: 9,
    title: "unclear",
    situation: "Need help with immigration paperwork for my family.",
    goal: "Understand next steps",
  });
  assert.equal(d.action, "reclassify_to_situation");
}

// Wiring
{
  const root = process.cwd();
  const apply = readFileSync(join(root, "src/lib/situation-reclassify-apply.ts"), "utf8");
  assert.ok(apply.includes("legacyCaseId"));
  assert.ok(apply.includes("reclassified_to_situation"));
  assert.ok(!apply.includes("runCaseAnalysis("), "reclassify must not run Case analysis");

  const actions = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.ok(actions.includes("invokes_case_engine"));
  assert.ok(actions.includes("governmentSystem"));

  const cli = readFileSync(join(root, "scripts/reclassify-legacy-cases.ts"), "utf8");
  assert.ok(cli.includes("--apply"));

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.ok(guide.includes("Track this government case") || guide.includes("Track this USCIS"));
}

console.log("phase-s4-case-lifecycle-check: ok");
