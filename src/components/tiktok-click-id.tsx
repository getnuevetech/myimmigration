"use client";

import { useEffect } from "react";

const TTCLID_COOKIE = "ttclid";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days — aligns with common CTA windows

function setCookie(name: string, value: string) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

/**
 * Persist TikTok click id from landing URL (?ttclid=) for Events API matching.
 */
export function TikTokClickIdCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ttclid = params.get("ttclid")?.trim();
      if (ttclid && ttclid.length < 512) setCookie(TTCLID_COOKIE, ttclid);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

declare global {
  interface Window {
    ttq?: {
      track: (event: string, props?: Record<string, unknown>, opts?: { event_id?: string }) => void;
      page: () => void;
    };
  }
}

/** Browser pixel track with matching event_id for Events API dedupe. */
export function trackTikTokBrowser(
  event: string,
  props: Record<string, unknown> = {},
  eventId?: string,
) {
  try {
    if (typeof window === "undefined" || !window.ttq?.track) return;
    if (eventId) window.ttq.track(event, props, { event_id: eventId });
    else window.ttq.track(event, props);
  } catch {
    /* ignore */
  }
}

/** Fire commerce funnel event in browser + Events API bridge. */
export function trackTikTokCommerceBrowser(
  event: "AddToCart" | "InitiateCheckout" | "CompletePayment" | "ViewContent",
  opts: {
    contentId: string;
    contentName: string;
    value?: number;
    currency?: string;
    eventId?: string;
  },
) {
  const eventId =
    opts.eventId ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${event}-${Date.now()}`);
  const props: Record<string, unknown> = {
    contents: [
      {
        content_id: opts.contentId,
        content_type: "product",
        content_name: opts.contentName,
      },
    ],
    content_type: "product",
  };
  if (typeof opts.value === "number") props.value = opts.value;
  if (opts.currency) props.currency = opts.currency;
  trackTikTokBrowser(event, props, eventId);
  void fetch("/api/tiktok/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventId,
      contentId: opts.contentId,
      contentName: opts.contentName,
      contentType: "product",
      value: opts.value,
      currency: opts.currency,
      url: typeof window !== "undefined" ? window.location.href : undefined,
    }),
    keepalive: true,
  }).catch(() => {});
  return eventId;
}
