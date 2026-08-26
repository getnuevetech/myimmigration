import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { featureLimit, getActivePlan, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { NoticeUpload } from "@/components/notice-upload";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView, caseListActionLine, caseListEvidenceLine } from "@/lib/case-presentation-list";
import { formatCaseNumber } from "@/lib/case-number";
import { matchInputFromCase, resolveVersionChrome } from "@/lib/goal-versions";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { noticeUploadAllowed, resolveNoticeEntitlement, resolveNoticePageCopy } from "@/lib/goal-notices";

export const metadata = { title: "USCIS notices" };

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const staff = isAdmin(user);
  const hasUpload = staff || (await hasFeature(user.id, FEATURE_KEYS.NOTICE_UPLOAD));
  const entitlement = resolveNoticeEntitlement({
    isStaff: staff,
    planKey: plan?.key,
    hasUpload,
  });
  const caseSelect = {
    id: true,
    situation: true,
    goal: true,
    issues: { select: { title: true, uscisBasis: true, conclusion: true } },
    notices: { select: { noticeType: true } },
  };
  const [notices, cases, scopedCase, used, limit] = await Promise.all([
    db.notice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { case: { select: { id: true, title: true, status: true, actionReadinessScore: true, situation: true, goal: true } } },
    }),
    db.case.findMany({
      where: { userId: user.id, status: { notIn: ["closed"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, title: true },
      take: 50,
    }),
    caseId
      ? db.case.findFirst({ where: { id: caseId, userId: user.id }, select: caseSelect })
      : db.case.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, select: caseSelect }),
    db.notice.count({ where: { userId: user.id } }),
    staff ? Promise.resolve(null) : featureLimit(user.id, FEATURE_KEYS.NOTICE_UPLOAD),
  ]);
  const quota = noticeUploadAllowed({
    canUpload: entitlement.canUpload,
    used,
    limit: entitlement.canUpload ? limit : 0,
  });
  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const copy = resolveNoticePageCopy({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
    authorityQueries: inquiry ? authorityQueriesForInquiry(inquiry) : [],
    sources: (scopedCase?.issues ?? []).map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
    hasNotices: (scopedCase?.notices.length ?? 0) > 0,
  });
  const defaultCaseId = cases.some((c) => c.id === caseId) ? caseId ?? "" : "";
  const views = await loadApprovedViewsByCaseIds(
    notices.map((n) => n.caseId).filter((id): id is string => Boolean(id)),
  );

  return (
    <div>
      <PageHeader title={copy.pageTitle} subtitle={copy.pageSubtitle} />

      {copy.skipBanner && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          {copy.skipBanner}{" "}
          <Link href={copy.primaryCta.href} className="font-semibold underline">{copy.primaryCta.label}</Link>
        </div>
      )}
      {entitlement.showUpgradeCta && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          Explaining a USCIS letter is included in Free with a cap.{" "}
          <Link href="/app/billing?upgrade=notices" className="font-semibold underline">See plans →</Link>
        </div>
      )}
      {quota.overLimit && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          You&apos;ve used all {limit} notice explanations included in Free.{" "}
          <Link href="/app/billing?upgrade=notices" className="font-semibold underline">Upgrade to Plus for unlimited notices →</Link>
        </div>
      )}
      {quota.allowed && quota.remaining !== null && (
        <p className="mb-4 text-xs text-slate-500">{quota.remaining} notice explanation{quota.remaining === 1 ? "" : "s"} remaining on Free.</p>
      )}

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            {copy.uploadPrimary ? "Add a USCIS letter" : "Have a USCIS letter? Add it here"}
          </h2>
          <NoticeUpload
            cases={cases.map((c) => ({ id: c.id, label: `${formatCaseNumber(c.number)} · ${c.title}` }))}
            defaultCaseId={defaultCaseId}
            locked={!quota.allowed}
            lockLabel={quota.overLimit ? "Upgrade to Plus for unlimited notices →" : "Unlock notice explanations with Plus →"}
          />
        </CardBody>
      </Card>

      {notices.length === 0 ? (
        <EmptyState
          title={copy.emptyTitle}
          body={copy.emptyBody}
          action={!copy.uploadPrimary ? <ButtonLink href={copy.primaryCta.href}>{copy.primaryCta.label}</ButtonLink> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => {
            const steps: { title: string; description: string }[] = JSON.parse(n.nextStepsJson || "[]");
            const summary = n.case
              ? caseListSummaryFromView(
                  {
                    status: n.case.status,
                    actionReadinessScore: n.case.actionReadinessScore,
                  },
                  views.get(n.case.id),
                  matchInputFromCase(n.case),
                )
              : null;
            return (
              <Card key={n.id}>
                <CardBody>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {n.noticeType ? `Notice ${n.noticeType}` : "USCIS notice"}
                      {n.caseYear ? ` · Year ${n.caseYear}` : ""}
                    </h2>
                    <div className="flex gap-2">
                      {n.deadline && (
                        <Badge color="red">Respond by {n.deadline.toLocaleDateString("en-US")}</Badge>
                      )}
                      <Badge color={n.status === "explained" ? "green" : "slate"}>{n.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  {summary && (
                    <div className="mt-3 rounded-xl border border-lime-200 bg-lime-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-lime-700">{resolveVersionChrome(matchInputFromCase(n.case)).fitsHeading}</p>
                      <p className="mt-1 text-sm font-medium text-lime-950">{n.case?.title}: {summary.posture}</p>
                      <p className="mt-0.5 text-sm text-lime-900">{caseListActionLine(summary)}</p>
                      <p className="mt-0.5 text-xs text-lime-800">{caseListEvidenceLine(summary)}</p>
                    </div>
                  )}
                  {n.explanation && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What this means</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.explanation}</p>
                    </div>
                  )}
                  {steps.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your next steps</p>
                      <ol className="mt-2 space-y-2">
                        {steps.map((s, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-100 text-xs font-bold text-lime-700">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{s.title}</p>
                              <p className="text-slate-500">{s.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <ButtonLink href={`/app/letters/new?notice=${n.id}${n.caseId ? `&case=${n.caseId}` : ""}&kind=${/rfe|request for evidence/i.test(n.noticeType ?? "") ? "rfe_response" : "notice_response"}`} variant="secondary" className="!px-3 !py-1.5 text-xs">
                      Draft a response letter
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
