/**
 * Phase SI-3 — Situation Intelligence Interview UI wiring.
 * Run: npm run test:phase-si-3
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  echoFactsFromSet,
  reconcileSituationFacts,
  runQuestionDirector,
  emptyInterviewState,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// Echo facts for Zimbabwe
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const echo = echoFactsFromSet(set);
  assert.ok(echo.some((e) => e.key === "country_of_origin" && /Zimbabwe/i.test(e.value)));
  assert.ok(echo.some((e) => e.key === "goal"));
  assert.ok(echo.some((e) => e.key === "inability_or_concern_about_return"));
}

// Director still wants questions before analysis for Zimbabwe
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const dir = runQuestionDirector(set, emptyInterviewState());
  assert.ok(dir.next, "underspecified Situation must open interview");
  assert.equal(dir.ready_for_analysis, false);
}

// UI wiring
{
  const view = read("src/components/situation-workspace-view.tsx");
  assert.ok(view.includes("SituationIntelligenceInterview"));
  assert.ok(view.includes("knownFactsJson"));
  assert.ok(view.includes("interviewActive"));
  assert.ok(view.includes("While we orient the facts") || view.includes("orient"));

  const ui = read("src/components/situation-intelligence-interview.tsx");
  assert.ok(ui.includes("Help us understand your situation"));
  assert.ok(ui.includes("answerSituationInterviewFormAction"));
  assert.ok(ui.includes("You already told us"));

  const appPage = read("src/app/app/situations/[id]/page.tsx");
  assert.ok(appPage.includes("knownFactsJson={row.knownFactsJson}"));

  const guestPage = read("src/app/start/situation/page.tsx");
  assert.ok(guestPage.includes("knownFactsJson={row.knownFactsJson}"));

  const actions = read("src/actions/situation-interview.ts");
  assert.ok(actions.includes("answerSituationInterviewFormAction"));
  assert.ok(read("src/lib/situation-intelligence/echo.ts").includes("peekSituationInterview"));
}

console.log("phase-si-3-interview-ui-check: ok");
