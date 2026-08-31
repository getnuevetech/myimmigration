import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActivePlan } from "@/lib/access";
import { PageHeader, Card, CardBody, Stat, ButtonLink, StateMark, ProgressBar, EmptyState, Badge } from "@/components/ui";
import { markNotificationReadAction } from "@/actions/user";
import { CaseListCard } from "@/components/case-list-card";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { resolveDashboardFiledCopy } from "@/lib/goal-notices";
import { resolveReadinessCopy } from "@/lib/goal-readiness";
import { matchInputFromCase } from "@/lib/goal-versions";
import { resolveIntakeChrome } from "@/lib/goal-intake";
import { resolveCasesListCopy } from "@/lib/goal-chrome";
import { formatSituationNumber } from "@/lib/situation";

export default async function DashboardPage() {
  const user = await requireUser();
  const [cases, issues, deadlines, notifications, plan, situationsResult] = await Promise.all([
    db.case.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        reconstruction: { select: { currentPosition: true } },
        issues: { select: { title: true, uscisBasis: true, conclusion: true } },
        notices: { select: { noticeType: true } },
      },
    }),
    db.issue.findMany({ where: { case: { userId: user.id }, state: { not: "resolved" } } }),
    db.deadline.findMany({ where: { userId: user.id, status: "open", dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 5 }),
    db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
    getActivePlan(user.id),
    // Isolate Situation queries — a missing migration must not white-screen /app.
    db.situation
      .findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          goal: true,
          originalNarrative: true,
          updatedAt: true,
        },
      })
      .then((rows) => ({ ok: true as const, rows }))
      .catch(() => ({ ok: false as const, rows: [] as Array<{
        id: string;
        number: number;
        title: string;
        status: string;
        goal: string;
        originalNarrative: string;
        updatedAt: Date;
      }> })),
  ]);
  const situations = situationsResult.rows;
  const situationsUnavailable = !situationsResult.ok;
  const views = await loadApprovedViewsByCaseIds(cases.map((item) => item.id));
  const latest = cases[0] ?? null;
  const inquiry = latest
    ? classifyImmigrationInquiry({ situation: latest.situation, goal: latest.goal })
    : null;
  const dashboardCopy = resolveDashboardFiledCopy({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${latest?.situation ?? ""} ${latest?.goal ?? ""}`,
    authorityQueries: inquiry ? authorityQueriesForInquiry(inquiry) : [],
    sources: (latest?.issues ?? []).map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: (latest?.notices ?? []).map((notice) => notice.noticeType),
    hasNotices: (latest?.notices.length ?? 0) > 0,
    hasDeadlines: deadlines.length > 0,
  });

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const approaching = deadlines.filter((d) => d.dueDate <= soon).length;
  const infoNeeded = issues.filter((i) => i.state === "info_needed").length;
  const actionItems = issues.filter((i) => ["action_needed", "urgent"].includes(i.state)).length;
  const avgReadiness = cases.length
    ? Math.round(cases.reduce((s, c) => s + c.readinessScore, 0) / cases.length)
    : 0;
  const dashboardReadiness = resolveReadinessCopy({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${latest?.situation ?? ""} ${latest?.goal ?? ""}`,
    noticeTypes: (latest?.notices ?? []).map((notice) => notice.noticeType),
  });
  const intake = resolveIntakeChrome({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode ?? "open_options",
    query: `${latest?.situation ?? ""} ${latest?.goal ?? ""}`,
    noticeTypes: (latest?.notices ?? []).map((notice) => notice.noticeType),
  });
  const situationListCopy = resolveCasesListCopy({ inquiryMode: "open_options" });
  const caseListCopy = resolveCasesListCopy({ inquiryMode: "existing_case" });
  const hasWorkspace = situations.length > 0 || cases.length > 0;

  return (
    <div>
      <PageHeader
        title={`Hi${user.firstName ? ` ${user.firstName}` : ""}, here's your immigration picture`}
        subtitle={plan ? `You're on the ${plan.name} plan` : undefined}
        actions={<ButtonLink href="/app/cases/new">{intake.listCta}</ButtonLink>}
      />

      {latest && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          Matching next step from official material:{" "}
          <Link href={dashboardCopy.matchingCta.href} className="font-semibold underline">{dashboardCopy.matchingCta.label}</Link>
        </div>
      )}

      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-lime-900">{n.title}</p>
                {n.body && <p className="text-sm text-lime-700">{n.body}</p>}
                {n.link && (
                  <Link href={n.link} className="text-sm font-medium text-lime-600 underline">
                    View →
                  </Link>
                )}
              </div>
              <form action={markNotificationReadAction.bind(null, n.id)}>
                <button className="text-xs text-lime-400 hover:text-lime-700">Dismiss</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Issues identified" value={issues.length} sub={infoNeeded > 0 ? `${infoNeeded} need more info` : undefined} />
        <Stat label="Deadlines approaching" value={approaching} sub="next 30 days" />
        <Stat label="Action items" value={actionItems} sub="urgent or needs action" />
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{dashboardReadiness.dashboardStatLabel}</p>
            <div className="mt-2">
              <ProgressBar value={avgReadiness} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{avgReadiness}% · {dashboardReadiness.dashboardStatHint}</p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">{situationListCopy.recentHeading}</h2>
              <Link href="/app/situations" className="text-xs font-medium text-lime-700 underline">
                View all
              </Link>
            </div>
            {situationsUnavailable ? (
              <EmptyState
                title="Situations temporarily unavailable"
                body="We could not load Situations right now. Cases below still work — try again after a refresh, or contact support if this continues."
              />
            ) : situations.length === 0 ? (
              <EmptyState
                title={situationListCopy.emptyTitle}
                body={situationListCopy.emptyBody}
                action={<ButtonLink href="/app/cases/new">{intake.firstCta}</ButtonLink>}
              />
            ) : (
              <div className="space-y-3">
                {situations.map((s) => (
                  <Link key={s.id} href={`/app/situations/${s.id}`} className="block">
                    <Card className="transition hover:border-lime-300">
                      <CardBody className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            <span className="mr-2 font-mono text-xs text-lime-600">{formatSituationNumber(s.number)}</span>
                            {s.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {s.goal || s.originalNarrative || "Immigration situation"}
                          </p>
                        </div>
                        <Badge color="slate">{s.status.replace(/_/g, " ")}</Badge>
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {(cases.length > 0 || hasWorkspace) && (
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">{caseListCopy.recentHeading}</h2>
                <Link href="/app/cases" className="text-xs font-medium text-lime-700 underline">
                  View all
                </Link>
              </div>
              {cases.length === 0 ? (
                <EmptyState title={caseListCopy.emptyTitle} body={caseListCopy.emptyBody} />
              ) : (
                <div className="space-y-3">
                  {cases.map((c) => (
                    <CaseListCard
                      key={c.id}
                      href={`/app/cases/${c.id}`}
                      number={c.number}
                      title={c.title}
                      status={c.status}
                      readinessScore={c.readinessScore}
                      compact
                      readinessLabel={resolveReadinessCopy({
                        inquiryMode: classifyImmigrationInquiry({ situation: c.situation, goal: c.goal }).mode,
                        query: `${c.situation} ${c.goal}`,
                        noticeTypes: c.notices.map((notice) => notice.noticeType),
                      }).overallLabel}
                      summary={caseListSummaryFromView(
                        {
                          status: c.status,
                          actionReadinessScore: c.actionReadinessScore,
                          reconstructionPosition: c.reconstruction?.currentPosition,
                        },
                        views.get(c.id),
                        matchInputFromCase(c),
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Upcoming deadlines</h2>
          {deadlines.length === 0 ? (
            <EmptyState title="Nothing due" body={dashboardCopy.deadlinesEmptyBody} />
          ) : (
            <div className="space-y-3">
              {deadlines.map((d) => (
                <Card key={d.id}>
                  <CardBody className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{d.title}</p>
                      <p className="text-xs text-slate-500">{d.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <StateMark state={d.dueDate <= soon ? "action_needed" : "review"} />
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
