import "server-only";
import { db } from "./db";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const KEYISH_RE = /\b(sk-[A-Za-z0-9]{10,}|Bearer\s+[A-Za-z0-9._\-]{10,}|api[_-]?key\s*[:=]\s*\S+)/gi;
const SSNISH_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const RECEIPTISH_RE = /\b[A-Z]{3}\d{10}\b/g;

export function redactForLog(value: unknown): string {
  const raw = value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
  return raw
    .replace(EMAIL_RE, "[email]")
    .replace(KEYISH_RE, "[redacted-secret]")
    .replace(SSNISH_RE, "[ssn]")
    .replace(RECEIPTISH_RE, "[receipt]")
    .slice(0, 5000);
}

// Central failure/event log surfaced in Admin → System logs.
// Fire-and-forget: logging must never break the flow that calls it.
export async function logSystem(
  level: "error" | "warning" | "info",
  source: string,
  message: string,
  detail?: unknown,
  userId?: string,
): Promise<void> {
  try {
    await db.systemLog.create({
      data: {
        level,
        source,
        message: redactForLog(message).slice(0, 300),
        detail: detail === undefined ? "" : redactForLog(detail),
        userId: userId ?? "",
      },
    });
  } catch {
    // Last resort: at least leave a trace in the server console.
    console.error(`[syslog:${level}:${source}]`, message.slice(0, 200));
  }
}

export async function purgeOldSystemLogs(days = 30): Promise<number> {
  const res = await db.systemLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - days * 24 * 3600000) } },
  });
  return res.count;
}
