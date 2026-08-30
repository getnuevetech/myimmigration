/**
 * Phase S5 — customer-facing copy / intake cleanup.
 * Never ask “open a case?”; Situation chrome for options; Case only for government matters.
 * Run: npx tsx scripts/phase-s5-customer-copy-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveIntakeChrome } from "../src/lib/goal-intake";
import { FILED_VERSION_REASON_LABELS, OPTIONS_VERSION_REASON_LABELS } from "../src/lib/goal-versions";
import { PUBLIC_HERO, STALE_PUBLIC_PRIMARY_CTAS } from "../src/lib/goal-public";
import { GUIDE_PROMPT_RULES } from "../src/lib/goal-guide";

{
  // Options / pre-filing chrome — Situation language, no “open a case?”
  const options = resolveIntakeChrome({});
  assert.match(options.pageTitle, /situation/i);
  assert.match(options.guideNewCaseLabel, /situation/i);
  assert.doesNotMatch(options.guideNewCaseMessage, /Want me to start it as a new case/i);
  assert.doesNotMatch(options.guideNewCaseMessage, /Want me to/i);
  assert.doesNotMatch(options.guideNewCaseLabel, /Yes — start this as a new case/i);
  assert.doesNotMatch(options.guideFallbackNoCase, /Start by creating a case/i);
  assert.doesNotMatch(options.guideNoCaseYet, /haven't started a case yet/i);
}

{
  // Filed / government matter chrome may say Case, but not “Want me to… open a case?”
  const filed = resolveIntakeChrome({
    inquiryMode: "existing_case",
    hasNotices: true,
  });
  assert.match(filed.pageTitle, /case/i);
  assert.equal(filed.guideNewCaseLabel, "Track this government case");
  assert.doesNotMatch(filed.guideNewCaseMessage, /Want me to/i);
  assert.doesNotMatch(filed.guideNewCaseMessage, /open this as a new case/i);
  assert.match(filed.prefillBanner, /government Case/i);
}

{
  assert.equal(FILED_VERSION_REASON_LABELS.analysis, "Case review");
  assert.doesNotMatch(FILED_VERSION_REASON_LABELS.analysis, /full case review/i);
  assert.equal(OPTIONS_VERSION_REASON_LABELS.analysis, "Options review");
}

{
  assert.equal(PUBLIC_HERO.primaryCta.label, "Explore my options");
  assert.ok(STALE_PUBLIC_PRIMARY_CTAS.includes("Start a case review"));
  assert.doesNotMatch(PUBLIC_HERO.primaryCta.label, /case review/i);
}

{
  assert.match(GUIDE_PROMPT_RULES, /Continue with my situation/);
  assert.match(GUIDE_PROMPT_RULES, /Track this government case/);
  assert.match(GUIDE_PROMPT_RULES, /Never ask whether they want to open a case/);
  assert.doesNotMatch(GUIDE_PROMPT_RULES, /Yes — start this as a new case/);
}

{
  const root = process.cwd();
  const intake = readFileSync(join(root, "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'));
  assert.ok(intake.includes("do not open a Case by themselves"));

  const v5 = readFileSync(join(root, "src/components/v5-customer-presentation-view.tsx"), "utf8");
  assert.ok(v5.includes("Your immigration situation"));
  assert.ok(v5.includes("Your USCIS case"));
  assert.ok(v5.includes('surface === "case"') || v5.includes("surface === \"case\""));
  // Must not hardcode Situation surfaces as "Your immigration case"
  assert.ok(!/Your immigration case/.test(v5));

  const analysis = readFileSync(join(root, "src/components/case-analysis-view.tsx"), "utf8");
  assert.ok(analysis.includes('surface={inquiry.mode === "open_options" ? "situation" : "case"}'));

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.doesNotMatch(guide, /full case review/i);
  assert.ok(guide.includes("Track this government case"));
  assert.ok(guide.includes("Continue with my situation"));

  const caseAction = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.ok(caseAction.includes("forceCase: false"));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md"), "utf8");
  assert.ok(/S5/.test(doc));
  assert.ok(doc.includes("test:phase-s5") || /customer-facing copy/i.test(doc));
}

console.log("phase-s5-customer-copy-check: ok");
