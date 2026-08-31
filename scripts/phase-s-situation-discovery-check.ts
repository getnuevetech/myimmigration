/**
 * Phase S — close Option B Case→Situation discovery bridge.
 * Situations list/nav/dashboard are first-class; Cases stay government-matter only.
 * Run: npx tsx scripts/phase-s-situation-discovery-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAccountNav, resolveCasesListCopy } from "../src/lib/goal-chrome";

{
  const openNav = resolveAccountNav({ inquiryMode: "open_options" });
  assert.ok(openNav.some((i) => i.href === "/app/situations" && i.label === "My situations"));
  assert.ok(openNav.some((i) => i.href === "/app/cases" && i.label === "My cases"));

  const filedNav = resolveAccountNav({ inquiryMode: "existing_case" });
  assert.ok(filedNav.some((i) => i.href === "/app/situations"));
  assert.ok(filedNav.some((i) => i.href === "/app/cases" && i.optional === false));
}

{
  assert.equal(resolveCasesListCopy({ inquiryMode: "open_options" }).pageTitle, "My situations");
  assert.equal(resolveCasesListCopy({ inquiryMode: "existing_case" }).pageTitle, "My cases");
  assert.match(resolveCasesListCopy({ inquiryMode: "existing_case" }).emptyBody, /My situations/i);
}

{
  const root = process.cwd();
  const sitList = readFileSync(join(root, "src/app/app/situations/page.tsx"), "utf8");
  assert.ok(sitList.includes("My situations"));
  assert.ok(sitList.includes("formatSituationNumber"));
  assert.ok(sitList.includes("db.situation.findMany"));

  const dash = readFileSync(join(root, "src/app/app/page.tsx"), "utf8");
  assert.ok(dash.includes("db.situation") && dash.includes("findMany"), "dashboard must load Situations");
  assert.ok(dash.includes("/app/situations"));
  assert.ok(dash.includes("formatSituationNumber"));
  assert.ok(dash.includes(".catch(") || dash.includes("situationsUnavailable"), "dashboard must harden Situation query failures");

  const cases = readFileSync(join(root, "src/app/app/cases/page.tsx"), "utf8");
  assert.ok(cases.includes('inquiryMode: "existing_case"'));
  assert.ok(cases.includes("/app/situations"));

  const chrome = readFileSync(join(root, "src/lib/goal-chrome.ts"), "utf8");
  assert.ok(chrome.includes('href: "/app/situations"'));
  assert.ok(chrome.includes("bridge closeout") || chrome.includes("Option B"));

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.ok(guide.includes('href: "/app/situations"'));

  const doc = readFileSync(join(root, "docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md"), "utf8");
  assert.ok(/Situation discovery|compatibility bridge/i.test(doc));
}

console.log("phase-s-situation-discovery-check: ok");
