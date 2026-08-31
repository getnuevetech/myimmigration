/**
 * Phase Billing — Free / Plus / Pro Filing Plan + forms matrix.
 * Run: npx tsx scripts/phase-billing-tier-matrix-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_KEYS } from "../src/lib/constants";
import { PUBLIC_PLAN_DESCRIPTIONS } from "../src/lib/goal-public";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

{
  assert.equal(FEATURE_KEYS.FILING_PLAN_BUILD, "filing_plan.build");
  assert.equal(FEATURE_KEYS.FORMS, "forms.wizard");
  assert.equal(FEATURE_KEYS.FORMS_DOWNLOAD, "forms.download");
}

{
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.free, /before you file/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.free, /Filing Plan|form wizard/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.plus, /have not filed yet/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.plus, /USCIS letter/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.plus, /capp?ed|Filing Plan/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.pro, /Unlimited|unlimited/i);
}

{
  const quotas = read("src/lib/billing-quotas.ts");
  assert.ok(quotas.includes("getFilingPlanQuota"));
  assert.ok(quotas.includes("getFormWizardQuota"));
  assert.ok(quotas.includes("getFormDownloadQuota"));
  assert.ok(quotas.includes("FEATURE_KEYS.FILING_PLAN_BUILD"));
}

{
  const action = read("src/actions/filing-plan.ts");
  assert.ok(action.includes("getFilingPlanQuota"));
  assert.ok(action.includes("Plus or Pro") || action.includes("upgrade"));
  assert.ok(!action.includes("runCaseAnalysis"));
}

{
  const forms = read("src/actions/forms.ts");
  assert.ok(forms.includes("getFormWizardQuota"));
  assert.ok(forms.includes("forms_limit") || forms.includes("overLimit"));
}

{
  const download = read("src/app/api/forms/[id]/download/route.ts");
  assert.ok(download.includes("getFormDownloadQuota"));
}

{
  const seed = read("prisma/seed.ts");
  assert.ok(seed.includes('"filing_plan.build"'));
  assert.ok(seed.includes("billingMatrix") || seed.includes("Phase Billing"));
  assert.match(seed, /filing_plan\.build[\s\S]*limit:\s*2/);
  assert.match(seed, /forms\.wizard[\s\S]*limit:\s*2/);
  assert.match(seed, /forms\.download[\s\S]*limit:\s*1/);
}

{
  const sitView = read("src/components/situation-workspace-view.tsx");
  assert.ok(sitView.includes("canBuildFilingPlan") || sitView.includes("filingPlanBlockedReason"));
  assert.ok(sitView.includes("Upgrade to Plus") || sitView.includes("billing?upgrade=filing_plan"));
}

{
  const health = read("src/app/api/health/route.ts");
  assert.ok(health.includes("CRON_SECRET") || health.includes("cron.secret"));
  assert.ok(health.includes("schemaReady"));
  assert.ok(health.includes("situation_table"));
}

{
  const dash = read("src/app/app/page.tsx");
  assert.ok(dash.includes(".catch(") || dash.includes("situationsUnavailable"));
  assert.ok(dash.includes("Situations temporarily unavailable") || dash.includes("situationsUnavailable"));
}

{
  const doc = read("docs/v5.1/PHASE-BILLING-TIER-MATRIX.md");
  assert.ok(doc.includes("filing_plan.build"));
  assert.ok(doc.includes("test:phase-billing") || doc.includes("phase-billing-tier-matrix-check"));
}

console.log("phase-billing-tier-matrix-check: ok");
