/**
 * Phase SI-4 — research + dual reasoners + SOL + consultant brief.
 * Run: npm run test:phase-si-4
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyFactFirewall,
  applyInterviewAnswer,
  emptyInterviewState,
  hasUscOrLprSpouseBasis,
  reconcileSituationFacts,
  runQuestionDirector,
  runSituationAnalysis,
} from "../src/lib/situation-intelligence";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

async function analyzeReady(narrative: string, goal: string) {
  let set = reconcileSituationFacts(narrative, goal);
  let interview = emptyInterviewState();
  // Drive interview to completion (max 6)
  for (let i = 0; i < 6; i++) {
    const dir = runQuestionDirector(set, interview);
    if (!dir.next || dir.ready_for_analysis) break;
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
    const applied = applyInterviewAnswer(set, interview, dir.next.candidate, answer);
    set = applied.factSet;
    interview = applied.interview;
  }
  return runSituationAnalysis(set, { enrichAuthority: false });
}

async function main() {
  // Zimbabwe: humanitarian yes, no I-130
  {
    const fx = JSON.parse(read("fixtures/situation-intelligence/zimbabwe.json"));
    const analysis = await analyzeReady(fx.narrative, fx.goal);
    assert.equal(analysis.schema_version, "si-analysis-0");
    assert.ok(analysis.research.some((r) => r.dimension === "humanitarian"));
    assert.ok(analysis.presentation.pathways.some((p) => /humanitarian|protection/i.test(p.id + p.condition)));
    assert.ok(
      analysis.presentation.not_recommended.some((n) => /I-130|spouse/i.test(n)) ||
        !analysis.presentation.pathways.some((p) => /i130|spouse/i.test(p.id)),
    );
    assert.equal(
      analysis.presentation.pathways.some((p) => /i130|spouse/i.test(p.id + p.condition)),
      false,
      "Zimbabwe analysis must not invent I-130 spouse pathway",
    );
    assert.ok(analysis.brief.reported_facts.length >= 1);
    assert.ok(Array.isArray(analysis.brief.ai_findings));
    assert.ok(Array.isArray(analysis.brief.unresolved));
    assert.ok(analysis.brief.reasoner_agreement);
  }

  // Mexico spouse: family pathway allowed
  {
    const fx = JSON.parse(read("fixtures/situation-intelligence/mexico-spouse.json"));
    let set = reconcileSituationFacts(fx.narrative, fx.goal);
    assert.ok(hasUscOrLprSpouseBasis(set));
    const analysis = await runSituationAnalysis(set, { enrichAuthority: false });
    assert.ok(analysis.presentation.pathways.some((p) => /family|i130/i.test(p.id)));
  }

  // Fact firewall unit
  {
    const set = reconcileSituationFacts("I am from France and want options.", "Options");
    const filtered = applyFactFirewall(
      [
        {
          id: "family_petition_i130",
          label: "Family I-130",
          why: "test",
          requires_facts: [],
        },
        {
          id: "open_options_orientation",
          label: "Open",
          why: "test",
          requires_facts: [],
        },
      ],
      set,
    );
    assert.equal(filtered.some((p) => p.id === "family_petition_i130"), false);
    assert.ok(filtered.some((p) => p.id === "open_options_orientation"));
  }

  // Novel situation still analyzes
  {
    const fx = JSON.parse(read("fixtures/situation-intelligence/novel.json"));
    const set = reconcileSituationFacts(fx.narrative, fx.goal);
    const analysis = await runSituationAnalysis(set, { enrichAuthority: false });
    assert.ok(analysis.presentation.paragraphs.length >= 1);
    assert.equal(analysis.presentation.pathways.some((p) => /i130|spouse/i.test(p.id)), false);
  }

  // Wiring
  {
    assert.ok(read("src/lib/situation-intelligence/analysis.ts").includes("runSituationAnalysis"));
    assert.ok(read("src/lib/situation-intelligence/persist-analysis.ts").includes("ensureSituationAnalysisPersisted"));
    assert.ok(
      read("src/components/situation-workspace-view.tsx").includes("ConsultantBriefPanel") ||
        read("src/components/situation-workspace-view.tsx").includes("Situation brief"),
    );
    assert.ok(read("src/actions/situation-interview.ts").includes("ensureSituationAnalysisPersisted"));
  }

  console.log("phase-si-4-analysis-brief-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
