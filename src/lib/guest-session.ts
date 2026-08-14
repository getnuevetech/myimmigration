import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const GUEST_SESSION_COOKIE = "mi_guest_session";
const GUEST_SESSION_TTL_DAYS = 30;

function getExpiryDate(): Date {
  return new Date(Date.now() + GUEST_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function persistCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentGuestSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.guestSession.findUnique({
    where: { sessionToken: token },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

export async function getOrCreateGuestSession() {
  const existing = await getCurrentGuestSession();
  if (existing) {
    const nextExpiry = getExpiryDate();
    const session = await prisma.guestSession.update({
      where: { id: existing.id },
      data: { expiresAt: nextExpiry },
    });
    await persistCookie(session.sessionToken, nextExpiry);
    return session;
  }

  const sessionToken = crypto.randomUUID();
  const expiresAt = getExpiryDate();
  const session = await prisma.guestSession.create({
    data: {
      sessionToken,
      expiresAt,
    },
  });

  await persistCookie(sessionToken, expiresAt);
  return session;
}
