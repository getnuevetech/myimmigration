import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";
import { CaseClarify } from "@/components/case-clarify";
import { loadSuggestionAccess, toCaseSuggestionAccess } from "@/lib/suggestion-quota";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { previewBestConsultantForThemes } from "@/lib/matching";
import { resolveCaseChrome } from "@/lib/goal-chrome";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await db.case.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, number: true, createdAt: true, situation: true, goal: true, _count: { select: { issues: true } } },
  });
  if (!c) notFound();

  const fullResults = await hasFeature(user.id, FEATURE_KEYS.CASE_FULL_RESULTS);
  const hasReportAccess = await hasFeature(user.id, FEATURE_KEYS.CASE_REPORT);
  const suggestionLoaded = await loadSuggestionAccess({ userId: user.id, caseId: c.id });
  let consultantName: string | null = null;
  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const chrome = resolveCaseChrome({
    caseId: c.id,
    inquiryMode: inquiry.mode,
    themes: inquiry.themes,
    query: `${c.situation} ${c.goal}`,
    hasReportAccess,
  });
  if (suggestionLoaded.entitlement.consultantReferral) {
    const preview = await previewBestConsultantForThemes(inquiry.themes).catch(() => null);
    consultantName = preview ? `${preview.name}, ${preview.credentialLabel}` : null;
  }
  const suggestionAccess = toCaseSuggestionAccess(suggestionLoaded, consultantName);

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · Opened ${c.createdAt.toLocaleDateString("en-US")} · ${c._count.issues} finding${c._count.issues === 1 ? "" : "s"}`}
        actions={
          <div className="flex gap-2">
            <a
              href={chrome.askHref}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {chrome.askLabel}
            </a>
            <a
              href={chrome.evidenceHref}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {chrome.evidenceLabel}
            </a>
            <a
              href={chrome.reportHref}
              target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title={hasReportAccess ? `View the full ${chrome.reportTitle} (print for PDF)` : "Included in higher plans"}
            >
              {chrome.reportLabel}
            </a>
          </div>
        }
      />
      <div className="mb-6">
        <CaseClarify caseId={c.id} access={suggestionAccess} />
      </div>
      <CaseAnalysisView caseId={c.id} viewer={{ role: "customer", userId: user.id, fullResults, suggestionAccess }} />
      <CaseComments caseId={c.id} viewer={{ role: "customer", userId: user.id }} />
    </div>
  );
}
