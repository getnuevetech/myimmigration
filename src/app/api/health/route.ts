import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, secureCookiesEnabled } from "@/lib/auth";
import { timingSafeEqualString } from "@/lib/rate-limit";

/**
 * Public liveness probe. No side effects, no session PII.
 * Maintenance jobs run only when Authorization: Bearer <CRON_SECRET>
 * (or ?secret=) matches process.env.CRON_SECRET or setting cron.secret.
 */
async function resolveCronSecret(): Promise<string> {
  if (process.env.CRON_SECRET?.trim()) return process.env.CRON_SECRET.trim();
  const row = await db.setting.findUnique({ where: { key: "cron.secret" } }).catch(() => null);
  return (row?.value ?? "").trim();
}

function authorizedCron(request: Request, secret: string): boolean {
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const urlSecret = new URL(request.url).searchParams.get("secret") || "";
  return timingSafeEqualString(bearer || urlSecret, secret);
}

export async function GET(request: Request) {
  let dbOk = false;
  let appUrl = "";
  try {
    const row = await db.setting.findUnique({ where: { key: "app.url" } });
    appUrl = row?.value ? "(configured)" : "(not set)";
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const cronSecret = dbOk ? await resolveCronSecret() : "";
  const runMaintenance = dbOk && authorizedCron(request, cronSecret);

  let maintenance: Record<string, number> | null = null;
  if (runMaintenance) {
    try {
      const { processScheduledMessages } = await import("@/lib/messaging");
      const { autoCloseInactiveTickets } = await import("@/actions/support");
      const { purgeExpiredDeletedAccounts } = await import("@/lib/deleted-accounts");
      const { purgeOldSystemLogs } = await import("@/lib/syslog");
      const { autoCloseCases } = await import("@/lib/case-closing");
      const { backfillEvidenceCases } = await import("@/lib/evidence/backfill");
      const evidenceBackfill = await backfillEvidenceCases(5);
      maintenance = {
        scheduledMessagesSent: await processScheduledMessages(),
        ticketsAutoClosed: await autoCloseInactiveTickets(),
        casesAutoClosed: await autoCloseCases(),
        accountsExpunged: await purgeExpiredDeletedAccounts(),
        oldLogsPurged: await purgeOldSystemLogs(30),
        evidenceDocumentsProcessed: evidenceBackfill.documentsProcessed,
        evidenceDocumentsFailed: evidenceBackfill.documentsFailed,
        evidenceCasesVerified: evidenceBackfill.casesVerified,
      };
    } catch {
      maintenance = { error: 1 };
    }
  }

  // Session presence only (no email/role) for authenticated probes.
  const user = await getCurrentUser().catch(() => null);

  return NextResponse.json({
    ok: true,
    database: dbOk ? "connected" : "unreachable",
    appUrlConfigured: appUrl === "(configured)",
    secureCookies: dbOk ? await secureCookiesEnabled() : null,
    signedIn: Boolean(user),
    maintenance,
    buildHasCookieFix: true,
  });
}
