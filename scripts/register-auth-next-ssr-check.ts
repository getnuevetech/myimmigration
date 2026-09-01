/**
 * Register/login must not set cookies during RSC render (Next.js throws).
 * Run: npx tsx scripts/register-auth-next-ssr-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeAuthNext } from "../src/lib/auth-continue";

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

{
  assert.equal(sanitizeAuthNext("/app/billing"), "/app/billing");
  assert.equal(sanitizeAuthNext("/app/situations/abc"), "/app/situations/abc");
}

{
  const register = read("src/app/register/page.tsx");
  assert.ok(!register.includes("setAuthNextCookie"), "register page must not set cookies in RSC render");
  assert.ok(register.includes('name="next"') || register.includes("next={next}"), "register must pass next into the form");
  assert.ok(register.includes("sanitizeAuthNext"));
}

{
  const login = read("src/app/login/page.tsx");
  assert.ok(!login.includes("setAuthNextCookie"), "login page must not set cookies in RSC render");
  assert.ok(login.includes("next={next}") || login.includes('name="next"'));
}

{
  const auth = read("src/actions/auth.ts");
  assert.ok(auth.includes('formData.get("next")'));
  assert.ok(auth.includes("setAuthNextCookie"), "Google signup action may still set cookie (Server Action)");
}

{
  const guest = read("src/lib/guest.ts");
  assert.ok(guest.includes("db.situation.updateMany"), "claimGuestSession must attach Situations");
}

console.log("register-auth-next-ssr-check: ok");
