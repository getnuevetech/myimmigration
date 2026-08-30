/**
 * Phase S3 — Filing Plan workspace checks.
 * Run: npx tsx scripts/phase-s3-filing-plan-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildFilingPlanContent } from "../src/lib/filing-plan";
import { runConversationIntelligence } from "../src/lib/conversation";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);

  const plan = buildFilingPlanContent({
    pathways: intel.strategy.branches.map((b) => ({ id: b.id, condition: b.condition, explanation: b.explanation })),
    narrative: CANONICAL,
  });
  assert.ok(plan.selectedPathway);
  assert.ok(plan.filings.length >= 1);
  assert.ok(plan.sequence.some((s) => /case/i.test(s)), "sequence should mention Case only after filing");
  assert.equal(plan.preparationStatus, "draft");
  assert.doesNotMatch(plan.pathwayLabel, /YOUR IMMIGRATION CASE/i);
}

{
  const aos = buildFilingPlanContent({ selectedPathway: "adjustment_of_status" });
  assert.ok(aos.filings.some((f) => f.form === "I-130"));
  assert.ok(aos.evidenceNeeds.every((e) => !/open a case/i.test(e)));

  const consular = buildFilingPlanContent({ selectedPathway: "consular_processing" });
  assert.ok(consular.filings.some((f) => f.form === "I-130"));
}

{
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model FilingPlan"));

  const action = readFileSync(join(process.cwd(), "src/actions/filing-plan.ts"), "utf8");
  assert.ok(action.includes("createFilingPlanAction"));
  assert.ok(!action.includes("runCaseAnalysis"), "Filing Plan must not run V5.1 Case analysis");

  const sitView = readFileSync(join(process.cwd(), "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(sitView.includes("Build my filing plan"));
  assert.ok(sitView.includes("createFilingPlanAction"));

  const planView = readFileSync(join(process.cwd(), "src/components/filing-plan-workspace-view.tsx"), "utf8");
  assert.ok(planView.includes("Filing Plan"));
  assert.ok(planView.includes("not a Case") || planView.includes("not a Case"));
  assert.doesNotMatch(planView, /YOUR IMMIGRATION CASE/);

  const appPage = readFileSync(join(process.cwd(), "src/app/app/filing-plans/[id]/page.tsx"), "utf8");
  assert.ok(appPage.includes("FilingPlanWorkspaceView"));
}

console.log("phase-s3-filing-plan-check: ok");
