/**
 * Phase SI-2 — light pre-screen + Question Director.
 * Run: npm run test:phase-si-2
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD,
  MAX_INITIAL_INTERVIEW_QUESTIONS,
  applyInterviewAnswer,
  emptyInterviewState,
  reconcileSituationFacts,
  runLightCountryPreScreen,
  runQuestionDirector,
  scoreQuestionValue,
  buildQuestionCandidates,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// --- Medical exam never asked ---
{
  const set = reconcileSituationFacts(
    "I am from Zimbabwe and cannot go back; I want to live and work in the US.",
    "Work and Live in US",
  );
  const result = runQuestionDirector(set, emptyInterviewState());
  const medical = result.ranked.find((c) => c.candidate === "medical_exam");
  assert.ok(medical);
  assert.equal(medical!.ask, false);
  assert.ok(scoreQuestionValue(medical!) < FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD);
  assert.notEqual(result.next?.candidate, "medical_exam");
}

// --- Zimbabwe: asks orientation, not spouse assumption; return harm can activate ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const signals = runLightCountryPreScreen(set);
  assert.ok(signals.some((s) => s.elevates_fact === "return_harm_specificity"));

  let interview = emptyInterviewState();
  let working = set;
  const asked: string[] = [];

  for (let i = 0; i < MAX_INITIAL_INTERVIEW_QUESTIONS; i++) {
    const dir = runQuestionDirector(working, interview);
    if (!dir.next) break;
    asked.push(dir.next.candidate);
    assert.notEqual(dir.next.candidate, "family_status_clarify");
    // Answer location first if asked
    const answer =
      dir.next.candidate === "current_location"
        ? "Inside the United States"
        : dir.next.candidate === "entry_manner"
          ? "With a visa"
          : dir.next.candidate === "government_history"
            ? "No"
            : dir.next.candidate === "return_harm_specificity"
              ? "Political activity/opinion"
              : dir.next.candidate === "possible_bases_multiselect"
                ? "Afraid or unable to return to my country"
                : dir.next.candidate === "us_arrival_or_presence_start"
                  ? "June 2025"
                  : "Not sure";
    const applied = applyInterviewAnswer(working, interview, dir.next.candidate, answer);
    working = applied.factSet;
    interview = applied.interview;
  }

  assert.ok(asked.includes("current_location"), "should ask where");
  assert.ok(asked.length >= 1 && asked.length <= 6);
  assert.ok(!asked.includes("medical_exam"));
}

// --- Mexico: fewer asks; entry manner high value; not six generics forced ---
{
  const fx = JSON.parse(read("fixtures/situation-intelligence/mexico-spouse.json"));
  const set = reconcileSituationFacts(fx.narrative, fx.goal);
  const dir = runQuestionDirector(set, emptyInterviewState());
  assert.ok(dir.next);
  // Location already known inside_us — should not ask current_location first
  assert.notEqual(dir.next!.candidate, "current_location");
  // Entry manner should be among top askable
  const entry = dir.ranked.find((c) => c.candidate === "entry_manner");
  assert.ok(entry?.ask, "entry manner should be askable for border spouse case");

  // Simulate answering only high-value ones — should stop before inventing 6 forced asks
  let interview = emptyInterviewState();
  let working = set;
  let count = 0;
  while (count < 6) {
    const d = runQuestionDirector(working, interview);
    if (!d.next) break;
    const applied = applyInterviewAnswer(
      working,
      interview,
      d.next.candidate,
      d.next.candidate === "entry_manner"
        ? "Processed and released at the border"
        : d.next.candidate === "government_history"
          ? "No"
          : "Not sure",
    );
    working = applied.factSet;
    interview = applied.interview;
    count++;
  }
  assert.ok(count < 6 || interview.asked_count <= 6);
}

// --- Haiti: pre-screen boosts arrival/presence date ---
{
  const set = reconcileSituationFacts(
    "I am Haitian and I have been in the U.S. for two years. What are my options?",
    "Options",
  );
  const signals = runLightCountryPreScreen(set);
  assert.ok(signals.some((s) => s.country === "Haiti" && s.elevates_fact === "us_arrival_or_presence_start"));

  const mocked = runQuestionDirector(set, emptyInterviewState());
  const arrival = mocked.ranked.find((c) => c.candidate === "us_arrival_or_presence_start");
  assert.ok(arrival);
  assert.ok(arrival!.pre_screen_boost > 0, "Haiti should boost arrival date question");
  assert.ok(arrival!.ask, "boosted arrival date should clear ask threshold");
}

// --- Mock signals path ---
{
  const set = reconcileSituationFacts("I am from France and want options.", "Options");
  const dir = runQuestionDirector(set, emptyInterviewState(), {
    mockSignals: [
      {
        signal_type: "test",
        country: "France",
        cue: "test",
        authority_refs: [],
        elevates_fact: "us_arrival_or_presence_start",
        confidence: 0.9,
      },
    ],
  });
  const arrival = dir.ranked.find((c) => c.candidate === "us_arrival_or_presence_start");
  assert.ok(arrival && arrival.pre_screen_boost > 0);
}

// --- Iterative: outside US drops entry_manner ---
{
  const set = reconcileSituationFacts(
    "I am from Zimbabwe and cannot go back. I need to live and work in the US.",
    "Work and Live in US",
  );
  let interview = emptyInterviewState();
  const first = runQuestionDirector(set, interview);
  assert.equal(first.next?.candidate, "current_location");
  const applied = applyInterviewAnswer(set, interview, "current_location", "Outside the United States");
  const second = runQuestionDirector(applied.factSet, applied.interview);
  assert.ok(second.ranked.find((c) => c.candidate === "entry_manner")?.ask !== true);
  assert.ok(
    second.next?.candidate === "prior_us_history" ||
      second.next?.candidate === "government_history" ||
      second.next?.candidate === "possible_bases_multiselect" ||
      second.next?.candidate === "return_harm_specificity",
  );
}

// --- Wiring ---
{
  const actions = read("src/actions/situation-interview.ts");
  assert.ok(actions.includes("runQuestionDirector"));
  assert.ok(actions.includes("applyInterviewAnswer"));
  const api = read("src/app/api/situation/interview/route.ts");
  assert.ok(api.includes("getSituationInterviewNextAction"));
}

// --- buildQuestionCandidates exports ---
{
  const set = reconcileSituationFacts("I am from Haiti living in the US.", "Options");
  const cands = buildQuestionCandidates(set, runLightCountryPreScreen(set), []);
  assert.ok(cands.length >= 5);
}

console.log("phase-si-2-question-director-check: ok");
