/**
 * Phase SI 0–1 — Situation Fact Set + anti-hallucination gates.
 * Run: npm run test:phase-si
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  composeAssistantReply,
  runConversationIntelligence,
} from "../src/lib/conversation";
import {
  FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD,
  FOUNDATIONAL_DIMENSIONS,
  MAX_INITIAL_INTERVIEW_QUESTIONS,
  SITUATION_FACT_STATES,
  factValue,
  hasUscOrLprSpouseBasis,
  reconcileSituationFacts,
  serializeFactSet,
  parseFactSet,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
const fixturesDir = join(root, "fixtures/situation-intelligence");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// --- Contracts frozen ---
{
  assert.equal(SITUATION_FACT_STATES.includes("reported"), true);
  assert.equal(SITUATION_FACT_STATES.includes("conflicted"), true);
  assert.equal(FOUNDATIONAL_DIMENSIONS.length, 6);
  assert.equal(MAX_INITIAL_INTERVIEW_QUESTIONS, 6);
  assert.ok(FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD > 0 && FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD < 1);
}

// --- Zimbabwe: extract origin/goal/return; no spouse; no I-130 ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  assert.equal(factValue(set, "country_of_origin"), "Zimbabwe");
  assert.equal(factValue(set, "goal"), "live_and_work_in_us");
  assert.equal(factValue(set, "inability_or_concern_about_return"), true);
  assert.equal(hasUscOrLprSpouseBasis(set), false);
  assert.equal(
    set.facts.some((f) => f.key === "fear_of_persecution"),
    false,
    "cannot go back must not establish fear_of_persecution",
  );
  assert.ok(set.activated_dimensions.includes("humanitarian"));
  assert.ok(!set.activated_dimensions.includes("family"));

  const intel = runConversationIntelligence({ message: fx.narrative, goal: fx.goal });
  const reply = composeAssistantReply(intel, fx.narrative);
  assert.equal(/\bI-130\b/i.test(reply), false, "Zimbabwe reply must not invent I-130");
  assert.equal(/\bU\.?S\.?-citizen spouse\b/i.test(reply), false, "must not invent USC spouse");
  assert.equal(intel.strategy.branches.some((b) => /i-?130|spouse/i.test(b.explanation)), false);

  const serialized = serializeFactSet(set);
  const parsed = parseFactSet(serialized);
  assert.ok(parsed);
  assert.equal(parsed!.schema_version === "si-0" || parsed!.schema_version === "si-1", true);
}

// --- Mexico: family basis + I-130 branches still allowed ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/mexico-spouse.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  assert.equal(factValue(set, "current_location"), "inside_us");
  assert.equal(factValue(set, "family_basis"), "usc_or_lpr_spouse");
  assert.equal(factValue(set, "usc_child"), true);
  assert.equal(factValue(set, "prior_filing"), "none_reported");
  assert.ok(hasUscOrLprSpouseBasis(set));

  const intel = runConversationIntelligence({ message: fx.narrative, goal: fx.goal });
  assert.ok(intel.strategy.branches.length >= 2, "Mexico spouse should still get pathway branches");
  const reply = composeAssistantReply(intel, fx.narrative);
  assert.match(reply, /I-130|spouse/i);
}

// --- Complete outside narrative ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/complete-outside.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  assert.equal(factValue(set, "current_location"), "outside_us");
  assert.equal(factValue(set, "country_of_origin"), "Canada");
  assert.equal(factValue(set, "family_basis"), "usc_or_lpr_spouse");
}

// --- Novel / untemplated: no spouse hallucination; no fixture-engine requirement ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/novel.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  assert.equal(hasUscOrLprSpouseBasis(set), false);
  const intel = runConversationIntelligence({ message: fx.narrative, goal: fx.goal });
  const reply = composeAssistantReply(intel, fx.narrative);
  assert.equal(/\bI-130\b/.test(reply), false);
  // Must run without a named scenario template id
  assert.ok(fx.expect.must_not_require_fixture_template);
}

// --- Persistence wiring ---
{
  const create = read("src/lib/situation-create.ts");
  assert.ok(create.includes("reconcileSituationFacts"), "Situation create must persist Fact Set");
  assert.ok(create.includes("serializeFactSet"));
  assert.equal(create.includes('knownFactsJson: "[]"'), false, "must not hardcode empty facts");
}

// --- Branch analysis gate ---
{
  const branches = read("src/lib/conversation/branch-analysis.ts");
  assert.ok(branches.includes("narrativeHasUscSpouse") || branches.includes("hasFamilySpouse"));
}

// --- Fixtures present ---
{
  const files = readdirSync(fixturesDir);
  assert.ok(files.includes("zimbabwe.json"));
  assert.ok(files.includes("mexico-spouse.json"));
  assert.ok(files.includes("novel.json"));
}

// --- Plan doc present ---
{
  const plan = read("docs/v5.1/PHASE-SI-SITUATION-INTELLIGENCE-INTERVIEW.md");
  assert.ok(plan.includes("LIGHT RESEARCH PRE-SCREEN"));
  assert.ok(plan.includes("reported | verified | derived | unknown | conflicted") || plan.includes("`reported`"));
}

console.log("phase-si-0-1-fact-set-check: ok");
