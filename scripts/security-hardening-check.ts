/**
 * Lightweight security remediation checks (no DB required).
 * Run: npx tsx scripts/security-hardening-check.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertSafeOutboundUrl } from "../src/lib/url-safety";
import { checkRateLimit, timingSafeEqualString } from "../src/lib/rate-limit";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

assert(timingSafeEqualString("abc", "abc"), "timingSafeEqualString should match equal strings");
assert(!timingSafeEqualString("abc", "abd"), "timingSafeEqualString should reject mismatches");
assert(!timingSafeEqualString("abc", "abcd"), "timingSafeEqualString should reject length mismatches");

const a = checkRateLimit({ key: "test-sec", limit: 2, windowMs: 60_000 });
const b = checkRateLimit({ key: "test-sec", limit: 2, windowMs: 60_000 });
const c = checkRateLimit({ key: "test-sec", limit: 2, windowMs: 60_000 });
assert(a.allowed && b.allowed && !c.allowed, "rate limiter should trip after limit");

try {
  assertSafeOutboundUrl("http://example.com/x");
  throw new Error("http should be rejected");
} catch (err) {
  assert(String(err).includes("https"), "http URLs must be rejected");
}
try {
  assertSafeOutboundUrl("https://127.0.0.1/secret");
  throw new Error("loopback should be rejected");
} catch (err) {
  assert(String(err).includes("not allowed") || String(err).includes("Invalid"), "private hosts must be rejected");
}
assert(assertSafeOutboundUrl("https://www.uscis.gov/forms/i-485.pdf").hostname.includes("uscis.gov"), "public https should pass");

const docs = read("src/actions/documents.ts");
assert(docs.includes("resolveOwnedCaseId"), "document upload must ownership-check caseId");
const comments = read("src/actions/comments.ts");
assert(comments.includes("validateUploadFile"), "comment attachments must validate MIME");
const support = read("src/actions/support.ts");
assert(support.includes("validateUploadFile"), "ticket attachments must validate MIME");
const health = read("src/app/api/health/route.ts");
assert(health.includes("CRON_SECRET") || health.includes("cron.secret"), "health maintenance must be secret-gated");
assert(!/session:\s*user\s*\?\s*\{\s*email/.test(health) && !health.includes("user.email"), "health must not return session email");
const auth = read("src/lib/auth.ts");
assert(auth.includes("sessionVersion") && auth.includes("bumpSessionVersion"), "sessions must support revocation");
const login = read("src/actions/auth.ts");
assert(login.includes("loginRateLimited") && login.includes("bumpSessionVersion"), "login rate limit + reset session bump required");
const report = read("src/lib/case-report.ts");
assert(report.includes("REPORT_EMBED_IMAGE_TYPES") && report.includes("esc(mime)"), "report MIME must be escaped/allowlisted");
const tickets = read("src/app/api/tickets/files/[id]/route.ts");
assert(tickets.includes("safeContentType") && tickets.includes("nosniff"), "ticket files must use safe content type");
const nextCfg = read("next.config.ts");
assert(nextCfg.includes("Content-Security-Policy") && nextCfg.includes("X-Content-Type-Options"), "security headers required");
assert(
  nextCfg.includes("https://analytics.tiktok.com") && nextCfg.includes("https://analytics.tiktokw.us"),
  "CSP must allow TikTok Pixel script/connect hosts",
);
const access = read("src/lib/case-access.ts");
assert(access.includes("consultantCanAccessClient") && access.includes("resolveOwnedCaseId"), "case ACL helper required");
const orch = read("src/lib/ai/orchestrator.ts");
assert(orch.includes("UNTRUSTED CONTENT RULE"), "AI fill must frame untrusted applicant/document content");
const uploads = read("src/lib/uploads.ts");
assert(uploads.includes("AVATAR_MIME_TYPES") && uploads.includes("MAX_UPLOAD_BYTES"), "upload allowlists must exist");
assert(uploads.includes("image/svg+xml") === false || !uploads.includes('"image/svg+xml"'), "avatars must not allow SVG");
const syslog = read("src/lib/syslog.ts");
assert(syslog.includes("redactForLog") && syslog.includes("[email]"), "syslog must redact PII");
const messaging = read("src/lib/messaging.ts");
assert(messaging.includes("escapeHtml") && messaging.includes("htmlMode"), "email templates must HTML-escape vars");

console.log("security hardening check passed");
