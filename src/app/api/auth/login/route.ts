import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { checkRateLimit, clientIpFromRequest, rateLimitKey } from "@/lib/rate-limit";

// Programmatic login (also usable with curl for diagnostics):
//   curl -i -c cookies.txt -X POST -d "email=...&password=..." <url>/api/auth/login
// Sets the same session cookie as the login page.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ ok: false, error: "Forbidden origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Forbidden origin" }, { status: 403 });
    }
  }

  let email = "";
  let password = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    email = String(body.email ?? "");
    password = String(body.password ?? "");
  } else {
    const form = await request.formData().catch(() => null);
    email = String(form?.get("email") ?? "");
    password = String(form?.get("password") ?? "");
  }

  const ip = clientIpFromRequest(request);
  const byIp = checkRateLimit({ key: rateLimitKey(["api-login-ip", ip]), limit: 30, windowMs: 15 * 60_000 });
  if (!byIp.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(byIp.retryAfterSec) } });
  }
  const byEmail = checkRateLimit({
    key: rateLimitKey(["api-login-email", email.toLowerCase()]),
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (!byEmail.allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(byEmail.retryAfterSec) } });
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ ok: false, error: "Account not active" }, { status: 403 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, email: user.email, role: user.role });
}
