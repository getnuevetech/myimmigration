"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackTikTokCommerceBrowser } from "@/components/tiktok-click-id";

const buttonStyles = {
  primary: "bg-lime-300 text-slate-950 hover:bg-lime-400 shadow-sm",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50",
} as const;

/** Pricing “Choose {plan}” — fires AddToCart before navigating to billing. */
export function TikTokChoosePlanLink({
  href,
  planId,
  planName,
  valueUsd,
  children,
  variant = "secondary",
  className = "",
}: {
  href: string;
  planId: string;
  planName: string;
  valueUsd: number;
  children: React.ReactNode;
  variant?: keyof typeof buttonStyles;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${buttonStyles[variant]} ${className}`}
      onClick={() => {
        if (valueUsd <= 0) return;
        trackTikTokCommerceBrowser("AddToCart", {
          contentId: `plan_${planId}`,
          contentName: planName,
          value: valueUsd,
          currency: "USD",
          eventId: `cart-pricing-${planId}`,
        });
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Fire CompletePayment in the browser once after a successful subscribe
 * (pixel parity; server already sent Events API CompletePayment).
 */
export function TikTokPaymentSuccess({
  planId,
  planName,
  valueUsd,
}: {
  planId: string;
  planName: string;
  valueUsd: number;
}) {
  useEffect(() => {
    if (!planId || valueUsd <= 0) return;
    const key = `tt-pay-${planId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    trackTikTokCommerceBrowser("CompletePayment", {
      contentId: `plan_${planId}`,
      contentName: planName,
      value: valueUsd,
      currency: "USD",
      eventId: `pay-browser-${planId}-${Date.now()}`,
    });
  }, [planId, planName, valueUsd]);
  return null;
}
