import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // TikTok Pixel loads events.js from analytics.tiktok.com (and .tiktokw.us fallback).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.tiktok.com https://analytics.tiktokw.us",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://analytics.tiktok.com https://analytics.tiktokw.us",
      "font-src 'self' data:",
      "connect-src 'self' https://analytics.tiktok.com https://analytics.tiktokw.us",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) must run as a real Node dependency — bundling it
  // breaks its worker/DOM handling and silently kills PDF text extraction.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  experimental: {
    serverActions: {
      // Document/photo uploads (intake, vault, notices, consultant credentials,
      // ticket attachments) flow through server actions; the framework default
      // of 1 MB rejects any real-world PDF or phone photo.
      // Cap closer to the 20 MB per-file limit (+ overhead) to reduce memory DoS.
      bodySizeLimit: "24mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
