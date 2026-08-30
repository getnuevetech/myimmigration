/**
 * Phase −1.9 L5 — Pattern Registry admin + promotion 0→4.
 * Run: npx tsx scripts/phase-minus1-9-l5-pattern-registry-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  PROMOTION_LABELS,
  PROMOTION_LEVELS,
  canPromoteToProduction,
  deidentifyExperienceRecord,
  isPromotionLevel,
  parsePromotionLevel,
  validatePromotionTarget,
  type ExperienceRecordV0,
} from "../src/lib/experience";

{
  assert.equal(PROMOTION_LABELS[0], "Observation");
  assert.equal(PROMOTION_LABELS[1], "Candidate");
  assert.equal(PROMOTION_LABELS[2], "Supported");
  assert.equal(PROMOTION_LABELS[3], "Reviewed");
  assert.equal(PROMOTION_LABELS[4], "Production");
  assert.deepEqual(PROMOTION_LEVELS, [0, 1, 2, 3, 4]);
  assert.equal(isPromotionLevel(4), true);
  assert.equal(isPromotionLevel(5), false);
  assert.equal(parsePromotionLevel("3"), 3);
  assert.throws(() => parsePromotionLevel("9"));
}

{
  const intel = runConversationIntelligence({
    message:
      "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?",
    goal: "options",
  });
  const record = intel.experience_record as ExperienceRecordV0;
  const anon = deidentifyExperienceRecord(record, { sourceId: "sit_l5" });

  // Canonical pathways turn has decision-changing facts → eligible for production.
  const eligible = canPromoteToProduction(anon);
  assert.equal(eligible.ok, true, eligible.reason);
  assert.equal(validatePromotionTarget(anon, 4).ok, true);
  assert.equal(validatePromotionTarget(anon, 2).ok, true);

  const empty = {
    ...anon,
    decision_changing_facts: [],
    negative_lesson_ids: [],
    has_reviewer_correction: false,
    outcome_kind: null,
    correction: undefined,
    outcome: undefined,
    decision_target: "",
  };
  const blocked = canPromoteToProduction(empty);
  assert.equal(blocked.ok, false);
}

{
  const root = process.cwd();
  const page = readFileSync(join(root, "src/app/admin/experience/page.tsx"), "utf8");
  assert.ok(page.includes("Pattern Registry"));
  assert.ok(page.includes("promoteExperiencePatternAction"));
  assert.ok(page.includes("PROMOTION_LEVELS"));

  const action = readFileSync(join(root, "src/actions/experience-registry.ts"), "utf8");
  assert.ok(action.includes("requireAdminArea"));
  assert.ok(action.includes("admin.experience"));
  assert.ok(action.includes("setPatternPromotionLevel"));
  assert.ok(!/fine-?tun/i.test(action));

  const registry = readFileSync(join(root, "src/lib/experience/registry.ts"), "utf8");
  assert.ok(registry.includes("setPatternPromotionLevel"));
  assert.ok(registry.includes("canPromoteToProduction"));
  assert.ok(registry.includes("listRegistryEntries"));

  const layout = readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8");
  assert.ok(layout.includes("/admin/experience"));

  const constants = readFileSync(join(root, "src/lib/constants.ts"), "utf8");
  assert.ok(constants.includes("admin.experience"));

  const pub = readFileSync(join(root, "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("minPromotionLevel: 4"));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L5/.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9-l5"));
  assert.ok(/Pattern Registry/i.test(doc));
}

console.log("phase-minus1-9-l5-pattern-registry-check: ok");
