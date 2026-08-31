import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, secureCookiesEnabled } from "@/lib/auth";
import { timingSafeEqualString } from "@/lib/rate-limit";

/**
 * Deep readiness probe for host ops (not for Lightsail LB — use GET /healthz over HTTP).
 * GET /api/health — does not require auth for liveness fields.
 * Maintenance jobs run only when Authorization: Bearer <CRON_SECRET>
 * (or ?secret=) matches process.env.CRON_SECRET or setting cron.secret.
 *
 * Schema readiness (Situation / Experience L7 columns) is reported for host
 * diagnosis of Digest white-screens after Phase S / −1.9 deploys — does not
 * fail the default liveness response.
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

async function schemaChecks(): Promise<{
  situation_table: "ok" | "missing" | "error";
  experience_observation: "ok" | "missing" | "error";
}> {
  const checks = {
    situation_table: "error" as "ok" | "missing" | "error",
    experience_observation: "error" as "ok" | "missing" | "error",
  };
  try {
    await db.situation.findFirst({ select: { id: true } });
    checks.situation_table = "ok";
  } catch {
    checks.situation_table = "missing";
  }
  try {
    await db.experienceObservation.findFirst({
      select: { id: true, staleAt: true, helpCount: true },
    });
    checks.experience_observation = "ok";
  } catch {
    checks.experience_observation = "missing";
  }
  return checks;
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
  const schema = dbOk
    ? await schemaChecks()
    : { situation_table: "error" as const, experience_observation: "error" as const };
  const schemaReady = Object.values(schema).every((v) => v === "ok");

  return NextResponse.json({
    ok: true,
    database: dbOk ? "connected" : "unreachable",
    appUrlConfigured: appUrl === "(configured)",
    secureCookies: dbOk ? await secureCookiesEnabled() : null,
    signedIn: Boolean(user),
    maintenance,
    buildHasCookieFix: true,
    schema,
    schemaReady,
    hint: schemaReady
      ? null
      : "Schema not ready — run `npx prisma migrate deploy` (or rebuild Docker so the entrypoint migrates), then restart. Missing Situation/Experience tables can white-screen /app for signed-in users.",
  });
}
