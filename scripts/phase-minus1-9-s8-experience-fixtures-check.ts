/**
 * Phase −1.9 S8 — Experience regression fixture pack.
 * Run: npx tsx scripts/phase-minus1-9-s8-experience-fixtures-check.ts
 * Also: npm run test:phase-minus1-9 (full L0–L7 + S8 gate)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  EXPERIENCE_FIXTURE_PACK,
  listExperienceFixtureIds,
  runExperienceFixturePack,
} from "../src/lib/experience";

{
  assert.ok(EXPERIENCE_CANONICAL_NARRATIVE.includes("Mexico"));
  assert.ok(EXPERIENCE_CANONICAL_NARRATIVE.includes("US citizen"));
  assert.match(EXPERIENCE_CANONICAL_NARRATIVE, /options/i);
}

{
  const ids = listExperienceFixtureIds();
  assert.ok(ids.length >= 8 && ids.length <= 14, `pack size should be ~8–12, got ${ids.length}`);
  assert.ok(ids.includes("exp_canonical_mexico_capture"));
  assert.ok(ids.includes("exp_neg_premature_medical_exam"));
  assert.ok(ids.includes("exp_production_search_l4"));
  assert.ok(ids.includes("exp_stale_excluded_from_serve"));
  assert.ok(ids.includes("exp_telemetry_auto_stale"));

  const results = runExperienceFixturePack();
  assert.equal(results.length, EXPERIENCE_FIXTURE_PACK.length);

  const negatives = results.filter((r) => r.kind === "negative");
  const positives = results.filter((r) => r.kind === "positive");
  assert.ok(negatives.length >= 2, "pack must include negative isolation fixtures");
  assert.ok(positives.length >= 4, "pack must include positive fixtures");
}

{
  const root = process.cwd();
  const pack = readFileSync(join(root, "src/lib/experience/fixture-pack.ts"), "utf8");
  assert.ok(pack.includes("EXPERIENCE_FIXTURE_PACK"));
  assert.ok(pack.includes("NEG-FAM-ENTRY-MEDICAL-001") || pack.includes("MEDICAL_EXAM_NEGATIVE_LESSON"));
  assert.ok(/No live fine-tuning/i.test(pack));
  assert.ok(/Outcome ≠ law|Outcome != law/i.test(pack) || pack.includes("Outcome ≠ law") || pack.includes("historical_experience"));

  const index = readFileSync(join(root, "src/lib/experience/index.ts"), "utf8");
  assert.ok(index.includes("fixture-pack"));
  assert.ok(index.includes("runExperienceFixturePack"));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/S8/.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9"));
  assert.ok(/Experience regression fixtures|fixture pack/i.test(doc));

  const s8doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-S8-EXPERIENCE-FIXTURES.md"), "utf8");
  assert.ok(s8doc.includes("test:phase-minus1-9-s8") || s8doc.includes("test:phase-minus1-9"));
}

console.log("phase-minus1-9-s8-experience-fixtures-check: ok");
