/**
 * Client components must not import the SI barrel (pulls server-only authority-retrieval).
 * Run: npm run test:si-client-bundle
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

{
  const qa = read("src/components/qa-chat.tsx");
  assert.ok(qa.includes('"use client"'));
  assert.ok(qa.includes('from "@/lib/conversation/decision-focus"'));
  assert.ok(!qa.includes("assistant-composer"));
  assert.ok(!qa.includes("situation-intelligence"));
}

{
  const composer = read("src/lib/conversation/assistant-composer.ts");
  assert.ok(composer.includes('from "@/lib/situation-intelligence/reconcile"'));
  assert.ok(!composer.includes('from "@/lib/situation-intelligence"'));
}

{
  const need = read("src/lib/conversation/need-to-know.ts");
  assert.ok(need.includes('from "@/lib/situation-intelligence/reconcile"'));
}

{
  const focus = read("src/lib/conversation/decision-focus.ts");
  assert.ok(focus.includes("decisionFocusLabel"));
  assert.ok(!focus.includes("situation-intelligence"));
  assert.ok(!focus.includes("authority-retrieval"));
}

console.log("si-client-bundle-check: ok");
