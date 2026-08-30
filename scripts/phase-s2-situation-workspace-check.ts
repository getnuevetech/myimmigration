/**
 * Phase S2 — Situation entity + UI invariants (no YOUR IMMIGRATION CASE on Situation).
 * Run: npx tsx scripts/phase-s2-situation-workspace-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

{
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model Situation"), "Situation model required (Option B)");
  assert.ok(schema.includes("model FilingPlan"), "FilingPlan model stub required");
  assert.ok(schema.includes("situationId"), "Case/Document/QaThread link to Situation");
  assert.ok(schema.includes("legacyCaseId"), "migration audit field required");
  assert.ok(schema.includes("governmentSystem"), "Case governmentSystem required");
}

{
  const view = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(view.includes("Your Immigration Situation"));
  assert.ok(view.includes("What you asked"));
  assert.ok(view.includes("What this may mean"));
  assert.ok(view.includes("One fact that changes the path") || view.includes("paths"));
  assert.ok(view.includes("Build my filing plan"));
  assert.doesNotMatch(view, /YOUR IMMIGRATION CASE/i);
  assert.ok(view.includes("not a USCIS Case") || view.includes("not a USCIS Case"));
}

{
  const page = readFileSync(join(root, "src/app/app/situations/[id]/page.tsx"), "utf8");
  assert.ok(page.includes("SituationWorkspaceView"));
  const guest = readFileSync(join(root, "src/app/start/situation/page.tsx"), "utf8");
  assert.ok(guest.includes("SituationWorkspaceView"));
}

{
  const sit = readFileSync(join(root, "src/lib/situation.ts"), "utf8");
  assert.ok(sit.includes("SIT-"));
  assert.ok(sit.includes("formatSituationNumber"));
}

{
  const migration = readFileSync(
    join(root, "prisma/migrations/20260830060000_phase_s_situation/migration.sql"),
    "utf8",
  );
  assert.ok(migration.includes("CREATE TABLE IF NOT EXISTS \"Situation\""));
}

console.log("phase-s2-situation-workspace-check: ok");
