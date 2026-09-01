/**
 * Guest/account + professional CTA emphasis in assistant copy.
 * Run: npx tsx scripts/guest-cta-emphasis-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { qaMonetizationFooter, type QaEntitlement } from "../src/lib/qa-access";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const guestEntitlement: QaEntitlement = {
  audience: "guest",
  qaEnabled: true,
  questionLimit: 1,
  maxSentences: 2,
  maxExcerpts: 1,
  maxFollowUps: 1,
  personalized: false,
  consultantReferral: false,
  showRegisterCta: true,
  showUpgradeCta: true,
  showConsultantCta: true,
  allowSaveOptionsCase: false,
};

{
  const guest = qaMonetizationFooter(guestEntitlement);
  assert.match(guest, /\*\*Create a free account\*\*/);
  assert.match(guest, /\*\*licensed immigration attorney or accredited representative\*\*/);
  assert.match(guest, /\*\*Licensed professionals on ImmigrationOnMe\*\*/);
}

{
  const reply = read("src/components/assistant-reply.tsx");
  assert.ok(reply.includes("text-teal-800"));
  assert.ok(reply.includes("font-semibold"));
  assert.ok(reply.includes('split(/(\\*\\*[^*]+\\*\\*)/g)'));
}

console.log("guest-cta-emphasis-check: ok");
