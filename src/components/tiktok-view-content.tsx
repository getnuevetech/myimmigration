"use client";

import { useEffect } from "react";
import { trackTikTokBrowser } from "@/components/tiktok-click-id";

/** Fire ViewContent once per mount (pricing, start, key marketing pages). */
export function TikTokViewContent({
  contentId,
  contentName,
}: {
  contentId: string;
  contentName: string;
}) {
  useEffect(() => {
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `vc-${contentId}-${Date.now()}`;
    trackTikTokBrowser(
      "ViewContent",
      {
        contents: [{ content_id: contentId, content_type: "product", content_name: contentName }],
        content_type: "product",
      },
      eventId,
    );
    void fetch("/api/tiktok/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "ViewContent",
        eventId,
        contentId,
        contentName,
        contentType: "product",
        url: window.location.href,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [contentId, contentName]);
  return null;
}

/** Attach to important CTAs (Start free, Create account, See plans). */
export function tiktokClickButton(contentName: string, contentId = "cta") {
  const eventId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `btn-${Date.now()}`;
  trackTikTokBrowser(
    "ClickButton",
    {
      contents: [{ content_id: contentId, content_type: "product", content_name: contentName }],
    },
    eventId,
  );
  void fetch("/api/tiktok/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "ClickButton",
      eventId,
      contentId,
      contentName,
      contentType: "product",
      url: typeof window !== "undefined" ? window.location.href : undefined,
    }),
    keepalive: true,
  }).catch(() => {});
}
