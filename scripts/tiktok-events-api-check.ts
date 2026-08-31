/**
 * TikTok Events API wiring (Imm1 pixel + server track).
 * Run: npx tsx scripts/tiktok-events-api-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

{
  const expected = createHash("sha256").update("alice@example.com").digest("hex");
  const normalized = "  Alice@Example.com  ".trim().toLowerCase();
  assert.equal(createHash("sha256").update(normalized).digest("hex"), expected);
}

{
  const lib = read("src/lib/tiktok-events.ts");
  assert.ok(lib.includes("open_api/v1.3/event/track"));
  assert.ok(lib.includes("CompleteRegistration"));
  assert.ok(lib.includes("CompletePayment"));
  assert.ok(lib.includes("AddToCart"));
  assert.ok(lib.includes("InitiateCheckout"));
  assert.ok(lib.includes("Pageview"));
  assert.ok(lib.includes("Access-Token"));
  assert.ok(lib.includes("analytics.tiktok_access_token"));
}

{
  const auth = read("src/actions/auth.ts");
  assert.ok(auth.includes("CompleteRegistration"));
  assert.ok(auth.includes("trackTikTokEventBeforeRedirect"));
}

{
  const billing = read("src/actions/billing.ts");
  assert.ok(billing.includes('event: "AddToCart"'));
  assert.ok(billing.includes('event: "InitiateCheckout"'));
}

{
  const payments = read("src/lib/payments.ts");
  assert.ok(payments.includes('event: "CompletePayment"'));
}

{
  const route = read("src/app/api/tiktok/event/route.ts");
  assert.ok(route.includes("Pageview"));
  assert.ok(route.includes("AddToCart"));
  assert.ok(route.includes("CompletePayment"));
}

{
  const user = read("src/actions/user.ts");
  assert.ok(user.includes('event: "Search"'));
}

{
  const support = read("src/actions/support.ts");
  assert.ok(support.includes('event: "Contact"'));
}

{
  const matching = read("src/actions/matching.ts");
  assert.ok(matching.includes('event: "Lead"'));
}

{
  const seed = read("prisma/seed.ts");
  assert.ok(seed.includes("analytics.tiktok_access_token"));
}

{
  const doc = read("docs/TIKTOK-EVENTS.md");
  assert.ok(doc.includes("DAASLUJC77U47UVQELH0"));
  assert.ok(doc.includes("Generate access token"));
  assert.ok(doc.includes("CompletePayment"));
  assert.ok(doc.includes("AddToCart"));
}

console.log("tiktok-events-api-check: ok");
