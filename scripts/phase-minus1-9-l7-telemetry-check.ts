/**
 * Phase −1.9 L7 — telemetry help/harm + stale/authority invalidation.
 * Run: npx tsx scripts/phase-minus1-9-l7-telemetry-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HARM_AUTO_STALE_MIN,
  filterServableProductionRows,
  isActivelyServable,
  shouldAutoStaleFromTelemetry,
} from "../src/lib/experience";

{
  assert.equal(shouldAutoStaleFromTelemetry(0, 2), false);
  assert.equal(shouldAutoStaleFromTelemetry(0, HARM_AUTO_STALE_MIN), true);
  assert.equal(shouldAutoStaleFromTelemetry(5, 9), false); // not yet 2x
  assert.equal(shouldAutoStaleFromTelemetry(3, 6), true);
  assert.equal(shouldAutoStaleFromTelemetry(10, 3), false);
}

{
  assert.equal(isActivelyServable({ promotionLevel: 4, staleAt: null }), true);
  assert.equal(isActivelyServable({ promotionLevel: 4, staleAt: new Date() }), false);
  assert.equal(isActivelyServable({ promotionLevel: 1, staleAt: null }), false);

  const rows = filterServableProductionRows([
    { promotionLevel: 4, staleAt: null, anonJson: "{}" },
    { promotionLevel: 4, staleAt: new Date(), anonJson: "{}" },
    { promotionLevel: 3, staleAt: null, anonJson: "{}" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].promotionLevel, 4);
}

{
  const root = process.cwd();
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("staleAt"));
  assert.ok(schema.includes("helpCount"));
  assert.ok(schema.includes("harmCount"));

  const mig = readFileSync(
    join(root, "prisma/migrations/20260830090000_experience_telemetry_l7/migration.sql"),
    "utf8",
  );
  assert.ok(mig.includes("staleAt"));
  assert.ok(mig.includes("helpCount"));

  const telemetry = readFileSync(join(root, "src/lib/experience/telemetry.ts"), "utf8");
  assert.ok(telemetry.includes("invalidatePatternsForAuthorityKey"));
  assert.ok(telemetry.includes("recordPatternFeedback"));
  assert.ok(telemetry.includes("markPatternStale"));
  assert.ok(/No live fine-tuning/i.test(telemetry));

  const pub = readFileSync(join(root, "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("excludeStale"));
  assert.ok(pub.includes("staleAt: null"));

  const search = readFileSync(join(root, "src/lib/experience/search.ts"), "utf8");
  assert.ok(search.includes("recordPatternServed"));

  const action = readFileSync(join(root, "src/actions/experience-registry.ts"), "utf8");
  assert.ok(action.includes("recordExperiencePatternFeedbackAction"));
  assert.ok(action.includes("markExperiencePatternStaleAction"));
  assert.ok(action.includes("invalidateExperiencePatternsForAuthorityAction"));

  const page = readFileSync(join(root, "src/app/admin/experience/page.tsx"), "utf8");
  assert.ok(page.includes("Help"));
  assert.ok(page.includes("Harm"));
  assert.ok(page.includes("Mark stale"));
  assert.ok(page.includes("Authority invalidation"));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L7/.test(doc));
  assert.ok(doc.includes("test:phase-minus1-9-l7"));
  assert.ok(/help\/harm|stale/i.test(doc));
}

console.log("phase-minus1-9-l7-telemetry-check: ok");
