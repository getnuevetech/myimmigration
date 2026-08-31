/**
 * Lightsail HTTP liveness route must exist and stay redirect-free.
 * Run: npx tsx scripts/lightsail-healthz-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const route = readFileSync(join(root, "src/app/healthz/route.ts"), "utf8");
assert.ok(route.includes('status: 200'));
assert.ok(route.includes("text/plain") || route.includes("ok"));
assert.ok(!route.includes("NextResponse.redirect"), "healthz must not redirect");
assert.ok(!route.includes("db."), "healthz must not touch the database");

const caddy = readFileSync(join(root, "deploy/Caddyfile.example"), "utf8");
assert.ok(caddy.includes("/healthz"));
assert.ok(caddy.includes("Lightsail"));

const deploy = readFileSync(join(root, "DEPLOYMENT.md"), "utf8");
assert.ok(deploy.includes("/healthz"));
assert.ok(/Lightsail/i.test(deploy));

console.log("lightsail-healthz-check: ok");
