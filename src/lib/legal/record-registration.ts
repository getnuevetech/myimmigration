import "server-only";

import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { LEGAL_ACCEPTANCE_SLUGS } from "./documents";
import { LEGAL_AGREEMENT_VERSION } from "./consents";
import {
  CONSULTANT_AGREEMENT_FORM_NAME,
  OAUTH_CONSENTS_COOKIE,
  OAUTH_GOOGLE_PENDING_COOKIE,
  parseOauthConsentsCookie,
  parsePendingGoogleProfile,
  serializeOauthConsentsCookie,
  type OauthConsentsCookie,
  type PendingGoogleProfile,
  type RegistrationConsentGrants,
} from "./consents";

export function newConsentReceiptId(): string {
  return `crc_${randomBytes(12).toString("hex")}`;
}

export async function requestAcceptanceEvidence(): Promise<{ ipAddress: string; userAgent: string }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for") ?? "";
  const ipAddress = forwarded.split(",")[0]?.trim() || h.get("x-real-ip") || "";
  const userAgent = h.get("user-agent") ?? "";
  return { ipAddress, userAgent };
}

export async function recordRegistrationLegal(options: {
  userId: string;
  grants: RegistrationConsentGrants;
  context: "registration" | "google_signup";
  consultantAgreement?: boolean;
}): Promise<{ receiptId: string }> {
  const receiptId = newConsentReceiptId();
  const { ipAddress, userAgent } = await requestAcceptanceEvidence();
  const slugs = options.consultantAgreement
    ? [...LEGAL_ACCEPTANCE_SLUGS, "consultant-agreement"]
    : [...LEGAL_ACCEPTANCE_SLUGS];
  const pages = await db.contentPage.findMany({
    where: { slug: { in: slugs }, isPublished: true },
    orderBy: { version: "desc" },
  });
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.slug)) continue;
    seen.add(page.slug);
    await db.agreementAcceptance.create({
      data: {
        userId: options.userId,
        pageId: page.id,
        version: page.version,
        context: options.context,
      },
    });
  }

  const rows = Object.entries(options.grants).map(([key, granted]) => ({
    userId: options.userId,
    key,
    granted,
    agreementVersion: LEGAL_AGREEMENT_VERSION,
    receiptId,
    ipAddress,
    userAgent,
    context: options.context,
  }));
  if (options.consultantAgreement) {
    rows.push({
      userId: options.userId,
      key: CONSULTANT_AGREEMENT_FORM_NAME.replace("consent_", ""),
      granted: true,
      agreementVersion: LEGAL_AGREEMENT_VERSION,
      receiptId,
      ipAddress,
      userAgent,
      context: options.context,
    });
  }
  await db.userConsent.createMany({ data: rows });
  return { receiptId };
}

const COOKIE_BASE = { httpOnly: true, sameSite: "lax" as const, path: "/" };

async function cookieOpts(extra: { maxAge: number }) {
  const { secureCookiesEnabled } = await import("@/lib/auth");
  return { ...COOKIE_BASE, secure: await secureCookiesEnabled(), ...extra };
}

export async function setOauthConsentsCookie(value: OauthConsentsCookie): Promise<void> {
  const store = await cookies();
  store.set(OAUTH_CONSENTS_COOKIE, serializeOauthConsentsCookie(value), await cookieOpts({ maxAge: 600 }));
}

export async function readOauthConsentsCookie(): Promise<OauthConsentsCookie | null> {
  const store = await cookies();
  return parseOauthConsentsCookie(store.get(OAUTH_CONSENTS_COOKIE)?.value);
}

export async function readPendingGoogleProfile(): Promise<PendingGoogleProfile | null> {
  const store = await cookies();
  return parsePendingGoogleProfile(store.get(OAUTH_GOOGLE_PENDING_COOKIE)?.value);
}

export function clearOauthLegalCookies(response: { cookies: { set: (name: string, value: string, opts: object) => void } }) {
  response.cookies.set(OAUTH_CONSENTS_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  response.cookies.set(OAUTH_GOOGLE_PENDING_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
}
