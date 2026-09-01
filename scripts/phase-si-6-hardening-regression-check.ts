/**
 * Phase SI-6 — hardening & regression gate across all SI fixtures.
 * Run: npm run test:phase-si-6
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SI_TELEMETRY,
  assertMedicalExamNotAsked,
  assertNoPrematureAnalysis,
  assertNoSpouseHallucination,
  emptyInterviewState,
  factValue,
  getSiTelemetryBuffer,
  hasUscOrLprSpouseBasis,
  reconcileSituationFacts,
  resetSiTelemetryBuffer,
  runQuestionDirector,
  runSituationAnalysis,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}
function fixture(name: string) {
  return JSON.parse(read(`fixtures/situation-intelligence/${name}.json`));
}

function fail(failures: { code: string; detail: string }[]) {
  if (failures.length) {
    assert.fail(failures.map((f) => `${f.code}: ${f.detail}`).join("; "));
  }
}

async function main() {
  // --- Zimbabwe: no spouse invent; orientation before analysis; humanitarian research ---
  {
    resetSiTelemetryBuffer();
    const fx = fixture("zimbabwe");
    const set = reconcileSituationFacts(fx.narrative, fx.goal);
    assert.equal(hasUscOrLprSpouseBasis(set), false);
    assert.equal(factValue(set, "inability_or_concern_about_return"), true);

    const dir = runQuestionDirector(set, emptyInterviewState());
    fail(assertNoPrematureAnalysis(set, dir));
    fail(assertMedicalExamNotAsked(dir));
    assert.ok(dir.next, "underspecified Zimbabwe must still ask orientation");
    assert.equal(dir.ready_for_analysis, false);

    const buf = getSiTelemetryBuffer();
    assert.ok(buf.some((e) => e.name === SI_TELEMETRY.interviewAskCount));
    assert.ok(
      buf.some(
        (e) =>
          e.name === SI_TELEMETRY.fullPersonalizedAnalysisBeforeFactOrientation && e.props.value === 0,
      ),
      "premature analysis telemetry must be 0 while still asking",
    );

    const analysis = await runSituationAnalysis(set, { enrichAuthority: false });
    fail(assertNoSpouseHallucination(set, analysis, fx.narrative));
    assert.ok(analysis.research.some((r) => r.dimension === "humanitarian"));
  }

  // --- Mexico spouse: family allowed; medical never asked ---
  {
    const fx = fixture("mexico-spouse");
    const set = reconcileSituationFacts(fx.narrative, fx.goal);
    assert.ok(hasUscOrLprSpouseBasis(set));
    const dir = runQuestionDirector(set, emptyInterviewState());
    fail(assertMedicalExamNotAsked(dir));
    const analysis = await runSituationAnalysis(set, { enrichAuthority: false });
    assert.ok(analysis.presentation.pathways.some((p) => /family|i130/i.test(p.id)));
    fail(assertNoSpouseHallucination(set, analysis, fx.narrative));
  }

  // --- Complete narrative: 0 asks, ready ---
  {
    const fx = fixture("complete-outside");
    const set = reconcileSituationFacts(fx.narrative, fx.goal);
    const dir = runQuestionDirector(set, emptyInterviewState());
    assert.equal(dir.next, null);
    assert.equal(dir.ready_for_analysis, true);
    assert.ok(dir.interview.stop_reason === "already_sufficient" || dir.interview.asked_count === 0);
    fail(assertMedicalExamNotAsked(dir));
  }

  // --- Novel: no template engine; no spouse invent ---
  {
    const fx = fixture("novel");
    const set = reconcileSituationFacts(fx.narrative, fx.goal);
    assert.equal(hasUscOrLprSpouseBasis(set), false);
    const dir = runQuestionDirector(set, emptyInterviewState());
    fail(assertMedicalExamNotAsked(dir));
    fail(assertNoPrematureAnalysis(set, dir));
    const analysis = await runSituationAnalysis(set, { enrichAuthority: false });
    fail(assertNoSpouseHallucination(set, analysis, fx.narrative));
    assert.ok(analysis.presentation.paragraphs.length >= 1);
  }

  // --- Wiring / ops contract ---
  {
    assert.ok(read("src/lib/situation-intelligence/telemetry.ts").includes("recordDirectorTelemetry"));
    assert.ok(read("src/lib/situation-intelligence/regression.ts").includes("assertNoSpouseHallucination"));
    assert.ok(read("docs/v5.1/OPS-CARRY-FORWARDS.md").includes("Situation Intelligence"));
    assert.equal(SI_TELEMETRY.fullPersonalizedAnalysisBeforeFactOrientation, "full_personalized_analysis_before_fact_orientation");
  }

  console.log("phase-si-6-hardening-regression-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
