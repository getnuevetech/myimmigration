import crypto from "crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Simple in-process rate limiter. Suitable for single-instance deploys;
 * use an edge/WAF or Redis limiter for multi-instance production scale.
 */
export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: options.limit - 1 };
  }
  if (existing.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSec: 0, remaining: options.limit - existing.count };
}

export function clientIpFromRequest(request: Request | null | undefined): string {
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || "unknown";
}

export function rateLimitKey(parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase() || "-").join("|");
}

/** Constant-time string compare for secrets (pads to equal length). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still run a compare to reduce timing signal on length alone.
    const pad = crypto.randomBytes(Math.max(left.length, 1));
    crypto.timingSafeEqual(pad, pad);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}
