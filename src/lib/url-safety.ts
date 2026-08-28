/**
 * Shared URL safety helpers for admin-configured outbound fetches (PDF templates, AI bases).
 * Blocks private/link-local/metadata targets to reduce SSRF risk.
 */

const BLOCKED_HOST_RE =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\]|metadata\.google\.internal|169\.254\.169\.254)$/i;

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function assertSafeOutboundUrl(raw: string, options?: { allowedHostSuffixes?: string[] }): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  const host = url.hostname;
  if (BLOCKED_HOST_RE.test(host) || isPrivateIpv4(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("URL host is not allowed");
  }
  const suffixes = options?.allowedHostSuffixes;
  if (suffixes && suffixes.length > 0) {
    const ok = suffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
    if (!ok) throw new Error("URL host is not on the allowlist");
  }
  return url;
}

/** Known AI vendor host suffixes (admin may override base URL within these). */
export const AI_VENDOR_HOST_SUFFIXES = [
  "openai.com",
  "anthropic.com",
  "googleapis.com",
  "google.com",
  "azure.com",
  "openai.azure.com",
];

export const PDF_SOURCE_HOST_SUFFIXES = [
  "uscis.gov",
  "justice.gov",
  "state.gov",
  "dhs.gov",
  "ecfr.gov",
  "federalregister.gov",
];
