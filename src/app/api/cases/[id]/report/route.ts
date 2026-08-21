import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { buildCaseReportHtml } from "@/lib/case-report";
import { getCaseReportQuota, recordCaseReportDownload } from "@/lib/case-report-downloads";

function billingRedirect(request: Request, pathname: string, params: Record<string, string>) {
  const url = new URL(request.url);
  const returnTo = `${url.pathname}${url.search}`;
  url.pathname = pathname;
  url.search = "";
  for (const [key, value] of Object.entries({ ...params, returnTo })) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

// Full case report (view inline or ?download=1). Access:
// - the case owner, when their plan includes the report feature (the "fee")
// - a consultant with an ACTIVE connection to the owner (plus a partner plan
//   when consultant subscriptions are enabled)
// - admins
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in required", { status: 401 });
  const c = await db.case.findUnique({ where: { id }, select: { userId: true } });
  if (!c) return new NextResponse("Not found", { status: 404 });

  let allowed = false;
  let shouldRecordOwnerDownload = false;
  if (isAdmin(user)) allowed = true;
  else if (c.userId === user.id) {
    const quota = await getCaseReportQuota(user.id);
    allowed = quota.hasAccess;
    if (!allowed) return billingRedirect(request, "/app/billing", { upgrade: "report" });
    if (quota.overLimit && quota.overageCents > 0) {
      return billingRedirect(request, "/app/billing", {
        reportOverage: "1",
        feeCents: String(quota.overageCents),
        used: String(quota.used),
        limit: String(quota.limit ?? ""),
      });
    }
    shouldRecordOwnerDownload = true;
  } else if (user.role === "consultant" && c.userId) {
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
    });
    if (assignment) {
      const { consultantSubscriptionsEnabled, hasActiveConsultantSubscription } = await import("@/lib/payments");
      allowed = !(await consultantSubscriptionsEnabled()) || (await hasActiveConsultantSubscription(user.id));
      if (!allowed) return billingRedirect(request, "/consultant/billing", { required: "1" });
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const report = await buildCaseReportHtml(id);
  if (!report) return new NextResponse("Not found", { status: 404 });
  if (shouldRecordOwnerDownload && c.userId) await recordCaseReportDownload(c.userId, id);

  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(report.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(download ? { "Content-Disposition": `attachment; filename="${report.fileName}"` } : {}),
    },
  });
}
