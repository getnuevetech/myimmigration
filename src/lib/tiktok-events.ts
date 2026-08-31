import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { getSetting } from "@/lib/settings";

export const TIKTOK_PIXEL_SETTING = "analytics.tiktok_pixel_id";
export const TIKTOK_TOKEN_SETTING = "analytics.tiktok_access_token";
export const TTCLID_COOKIE = "ttclid";

export type TikTokStandardEvent =
  | "ViewContent"
  | "Search"
  | "Contact"
  | "ClickButton"
  | "AddToWishlist"
  | "CompleteRegistration"
  | "Lead"
  | "SubmitForm";

export type TikTokEventInput = {
  event: TikTokStandardEvent;
  eventId?: string;
  url?: string;
  contentId?: string;
  contentType?: string;
  contentName?: string;
  searchString?: string;
  value?: number;
  currency?: string;
  email?: string | null;
  phone?: string | null;
  externalId?: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Best-effort E.164-ish normalize: digits with leading +. */
function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return null;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function hashTikTokEmail(email: string): string {
  return sha256(normalizeEmail(email));
}

export function hashTikTokExternalId(id: string): string {
  return sha256(id.trim());
}

export function hashTikTokPhone(phone: string): string | null {
  const normalized = normalizePhone(phone);
  return normalized ? sha256(normalized) : null;
}

async function resolveCredentials(): Promise<{ pixelId: string; accessToken: string } | null> {
  const [pixelId, accessToken] = await Promise.all([
    getSetting(TIKTOK_PIXEL_SETTING, "DAASLUJC77U47UVQELH0"),
    (async () => {
      const fromEnv = process.env.TIKTOK_ACCESS_TOKEN?.trim();
      if (fromEnv) return fromEnv;
      return getSetting(TIKTOK_TOKEN_SETTING, "");
    })(),
  ]);
  const id = pixelId.trim();
  const token = accessToken.trim();
  if (!id || !token) return null;
  return { pixelId: id, accessToken: token };
}

export async function getTikTokRequestContext(): Promise<{
  ip?: string;
  userAgent?: string;
  ttclid?: string;
  ttp?: string;
  url?: string;
}> {
  const h = await headers();
  const jar = await cookies();
  const ip =
    (h.get("x-forwarded-for") || h.get("x-real-ip") || "")
      .split(",")[0]
      ?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;
  const ttclid = jar.get(TTCLID_COOKIE)?.value || undefined;
  const ttp = jar.get("_ttp")?.value || undefined;
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const path = h.get("x-url") || h.get("x-invoke-path") || "";
  const url = path && host ? `${proto}://${host}${path}` : host ? `${proto}://${host}` : undefined;
  return { ip, userAgent, ttclid, ttp, url };
}

/**
 * POST one web event to TikTok Events API v1.3.
 * No-ops when pixel ID or access token is missing. Never throws to callers.
 */
export async function trackTikTokEvent(input: TikTokEventInput): Promise<{ ok: boolean; skipped?: boolean }> {
  try {
    const creds = await resolveCredentials();
    if (!creds) return { ok: true, skipped: true };

    const ctx = await getTikTokRequestContext();
    const eventId = input.eventId || randomUUID();
    const eventTime = Math.floor(Date.now() / 1000);

    const user: Record<string, string> = {};
    if (input.email) user.email = hashTikTokEmail(input.email);
    if (input.phone) {
      const hashed = hashTikTokPhone(input.phone);
      if (hashed) user.phone = hashed;
    }
    if (input.externalId) user.external_id = hashTikTokExternalId(input.externalId);
    if (ctx.ttclid) user.ttclid = ctx.ttclid;
    if (ctx.ttp) user.ttp = ctx.ttp;
    if (ctx.ip) user.ip = ctx.ip;
    if (ctx.userAgent) user.user_agent = ctx.userAgent;

    const properties: Record<string, unknown> = {};
    if (input.contentId || input.contentName || input.contentType) {
      properties.contents = [
        {
          ...(input.contentId ? { content_id: input.contentId } : {}),
          ...(input.contentType ? { content_type: input.contentType } : { content_type: "product" }),
          ...(input.contentName ? { content_name: input.contentName } : {}),
        },
      ];
      if (input.contentId) properties.content_ids = [input.contentId];
      if (input.contentType) properties.content_type = input.contentType;
    }
    if (input.searchString) properties.search_string = input.searchString.slice(0, 500);
    if (typeof input.value === "number") properties.value = input.value;
    if (input.currency) properties.currency = input.currency;

    const pageUrl = input.url || ctx.url || (await getSetting("app.url", "https://immigrationonme.com"));

    const body = {
      event_source: "web",
      event_source_id: creds.pixelId,
      data: [
        {
          event: input.event,
          event_time: eventTime,
          event_id: eventId,
          user,
          page: { url: pageUrl },
          ...(Object.keys(properties).length ? { properties } : {}),
        },
      ],
    };

    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Access-Token": creds.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[tiktok-events]", res.status, text.slice(0, 300));
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.warn("[tiktok-events]", err instanceof Error ? err.message : "failed");
    return { ok: false };
  }
}

/** Await briefly so redirects still get a chance to flush the event. */
export async function trackTikTokEventBeforeRedirect(input: TikTokEventInput): Promise<void> {
  await Promise.race([
    trackTikTokEvent(input),
    new Promise<void>((resolve) => setTimeout(resolve, 1200)),
  ]);
}
