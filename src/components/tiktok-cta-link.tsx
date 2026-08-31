"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { tiktokClickButton } from "@/components/tiktok-view-content";

/** Marketing CTA link that also fires TikTok ClickButton. */
export function TikTokCtaLink({
  href,
  className,
  children,
  contentName,
  contentId = "cta",
}: {
  href: string;
  className?: string;
  children: ReactNode;
  contentName: string;
  contentId?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => tiktokClickButton(contentName, contentId)}
    >
      {children}
    </Link>
  );
}
