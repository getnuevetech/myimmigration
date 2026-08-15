import "server-only";

import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { claimGuestCasesForUser } from "@/lib/cases";
import { getCurrentGuestSession } from "@/lib/guest-session";
import type { AdminAreaKey } from "@/lib/admin-areas";

const SESSION_COOKIE = "myimmigration_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_SCHEME = "scrypt";

const CURRENT_USER_INCLUDE = {
  adminRole: {
    include: {
      permissions: true,
    },
  },
} satisfies Prisma.UserInclude;

export type CurrentUser = Prisma.UserGetPayload<{
  include: typeof CURRENT_USER_INCLUDE;
}>;

type SessionPayload = {
  sub: string;
  exp: number;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

async function getAuthSecret(): Promise<string> {
  if (process.env.AUTH_SESSION_SECRET && process.env.AUTH_SESSION_SECRET.length >= 32) {
    return process.env.AUTH_SESSION_SECRET;
  }

  const configured = await prisma.setting.findUnique({
    where: { key: "AUTH_SESSION_SECRET" },
    select: { value: true },
  });

  if (configured?.value && configured.value.length >= 32) {
    return configured.value;
  }

  const generated = crypto.randomBytes(32).toString("base64url");
  const setting = await prisma.setting.upsert({
    where: { key: "AUTH_SESSION_SECRET" },
    update: { value: generated, type: "env", group: "runtime", isSecret: true },
    create: {
      key: "AUTH_SESSION_SECRET",
      value: generated,
      type: "env",
      group: "runtime",
      description: "Session signing secret generated at first auth use.",
      isSecret: true,
    },
    select: { value: true },
  });

  return setting.value;
}

async function secureCookiesEnabled(): Promise<boolean> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) {
    return fromEnv.toLowerCase().startsWith("https://");
  }

  const setting = await prisma.setting.findUnique({
    where: { key: "NEXT_PUBLIC_APP_URL" },
    select: { value: true },
  });

  return setting?.value.trim().toLowerCase().startsWith("https://") ?? false;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });

  return `${PASSWORD_SCHEME}:${salt}:${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, expectedHash] = storedHash.split(":");
  if (scheme !== PASSWORD_SCHEME || !salt || !expectedHash) {
    return false;
  }

  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
  const expected = Buffer.from(expectedHash, "base64url");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

async function encodeSession(payload: SessionPayload): Promise<string> {
  const body = base64url(JSON.stringify(payload));
  const signature = sign(body, await getAuthSecret());
  return `${body}.${signature}`;
}

async function decodeSession(token: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body, await getAuthSecret());
  const signatureBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await encodeSession({ sub: userId, exp: expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookiesEnabled(),
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await decodeSession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: CURRENT_USER_INCLUDE,
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: Pick<CurrentUser, "type">): boolean {
  return user.type === "ADMIN";
}

export function hasAdminPermission(
  user: CurrentUser,
  areaKey?: AdminAreaKey,
  manage = false
): boolean {
  if (!isAdmin(user)) return false;
  if (!areaKey) return true;
  try {
    const scope = JSON.parse(user.adminRole?.scopeJson ?? "{}") as {
      all?: boolean;
      areas?: string[];
    };
    if (scope.all) return true;
    if (scope.areas?.includes(areaKey)) return true;
  } catch {
    // Fall back to explicit permission rows below.
  }
  return (
    user.adminRole?.permissions.some(
      (permission) =>
        permission.key === areaKey && (manage ? permission.canManage : permission.canView)
    ) ?? false
  );
}

export async function requireAdmin(areaKey?: AdminAreaKey, manage = false): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasAdminPermission(user, areaKey, manage)) redirect(isAdmin(user) ? "/admin" : "/dashboard");
  return user;
}

export async function claimCurrentGuestSession(userId: string): Promise<void> {
  const session = await getCurrentGuestSession();
  if (!session) return;

  await prisma.guestSession.update({
    where: { id: session.id },
    data: { linkedUserId: userId },
  });
  await claimGuestCasesForUser(session.id, userId);
}
