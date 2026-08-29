/**
 * Phase G — full V5.1 fixture pack with positive/negative isolation tests.
 * Run: npx tsx scripts/phase-g-fixture-pack-check.ts
 */
import assert from "node:assert/strict";
import { V51_FIXTURE_PACK, listV51FixtureIds } from "../src/lib/v51-fixture-pack";
import { buildSituationBrief } from "../src/lib/situation-brief";
import { caseTypeLockFromBrief, shouldExcludeCountryConditions } from "../src/lib/case-type-lock";
import { assembleV5CustomerPresentation, v5CustomerPresentationText } from "../src/lib/v5-customer-presentation";
import { rankMatchingDocuments } from "../src/lib/goal-documents";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";

function runFixture(id: string) {
  const fixture = V51_FIXTURE_PACK.find((f) => f.id === id);
  assert.ok(fixture, `unknown fixture ${id}`);
  const brief = buildSituationBrief(fixture.input);
  const lock = caseTypeLockFromBrief(brief);
  const docs = (fixture.input.documents ?? []).map((doc, i) => ({
    id: `doc_${i}`,
    fileName: doc.fileName ?? `doc-${i}.pdf`,
    documentType: doc.documentType,
    contentHash: `hash_${i}`,
  }));
  const ledger = buildFactLedger({
    situation: fixture.input.situation,
    goal: fixture.input.goal,
    documents: docs.map((d, i) => ({
      ...d,
      text: fixture.input.documents?.[i]?.text ?? "",
    })),
  });
  const view = assembleV5CustomerPresentation({
    brief,
    documents: docs,
    factLedger: ledger,
  });
  const text = v5CustomerPresentationText(view);
  const rankedDocs = rankMatchingDocuments({
    query: `${fixture.input.situation ?? ""} ${fixture.input.goal ?? ""}`,
    inquiryMode: brief.doNotRecommendNewPathway ? "existing_case" : "open_options",
    themes: brief.primaryForm === "I-589" ? ["asylum"] : brief.primaryForm === "I-130" ? ["family"] : ["general"],
    caseLock: lock,
  });
  const kinds = rankedDocs.map((d) => d.kind);

  const iso = fixture.isolation;
  if (iso.primary_form !== undefined) {
    assert.equal(
      brief.primaryForm,
      iso.primary_form,
      `${id}: expected primaryForm ${iso.primary_form}, got ${brief.primaryForm}`,
    );
  }
  if (iso.do_not_recommend_new_pathway !== undefined) {
    assert.equal(
      brief.doNotRecommendNewPathway,
      iso.do_not_recommend_new_pathway,
      `${id}: doNotRecommendNewPathway`,
    );
  }
  if (iso.lock_family_open_options_i130 !== undefined) {
    assert.equal(
      brief.lockFamilyOpenOptionsI130,
      iso.lock_family_open_options_i130,
      `${id}: lockFamilyOpenOptionsI130`,
    );
  }
  for (const re of iso.must_allow ?? []) {
    assert.ok(
      re.test(text) || re.test(brief.caseType) || re.test(brief.relatedProcess ?? "") || re.test(view.keyPoint.body.join("\n")),
      `${id}: must_allow failed: ${re}`,
    );
  }
  for (const re of iso.must_forbid ?? []) {
    assert.equal(re.test(text), false, `${id}: must_forbid matched: ${re} in customer text`);
  }
  for (const kind of iso.must_include_doc_kinds ?? []) {
    assert.ok(kinds.includes(kind), `${id}: expected doc kind ${kind}, got ${kinds.join(",")}`);
  }
  for (const kind of iso.must_exclude_doc_kinds ?? []) {
    assert.ok(!kinds.includes(kind), `${id}: forbidden doc kind ${kind} present`);
    if (kind === "country_conditions") {
      assert.equal(shouldExcludeCountryConditions(lock), true, `${id}: shouldExcludeCountryConditions`);
    }
  }

  return { id, kind: fixture.kind, primaryForm: brief.primaryForm, actions: view.whatToDoNext.length };
}

function main() {
  const ids = listV51FixtureIds();
  assert.ok(ids.length >= 8 && ids.length <= 14, `pack size should be ~8–12, got ${ids.length}`);
  assert.ok(ids.includes("vawa_i360_pending_i485"));
  assert.ok(ids.includes("vawa_neg_i589_country_conditions"));
  assert.ok(ids.includes("asylum_i589"));
  assert.ok(ids.includes("marriage_i130_open_options"));

  const results = ids.map(runFixture);
  const negatives = results.filter((r) => r.kind === "negative");
  assert.ok(negatives.length >= 1, "pack must include at least one negative isolation fixture");

  console.log(`phase-g-fixture-pack-check: ok (${results.length} fixtures)`);
  for (const r of results) {
    console.log(`- ${r.id} [${r.kind}] primary=${r.primaryForm ?? "none"} actions=${r.actions}`);
  }
}

main();
