import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { claimCurrentGuestSession, createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let email = "";
  let password = "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    email = String(body.email ?? "").trim().toLowerCase();
    password = String(body.password ?? "");
  } else {
    const form = await request.formData().catch(() => null);
    email = String(form?.get("email") ?? "").trim().toLowerCase();
    password = String(form?.get("password") ?? "");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }
  if (user.status !== "ACTIVE") {
    return NextResponse.json({ ok: false, error: "Account is not active." }, { status: 403 });
  }

  await claimCurrentGuestSession(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true, email: user.email, type: user.type });
}
