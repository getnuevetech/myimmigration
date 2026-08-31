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
