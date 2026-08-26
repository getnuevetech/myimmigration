import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CaseListCard } from "@/components/case-list-card";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { resolveCasesListCopy } from "@/lib/goal-chrome";
import { resolveReadinessCopy } from "@/lib/goal-readiness";
import { matchInputFromCase } from "@/lib/goal-versions";
import { resolveIntakeChrome } from "@/lib/goal-intake";

export const metadata = { title: "My cases" };

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { reconstruction: { select: { currentPosition: true } } },
  });
  const views = await loadApprovedViewsByCaseIds(cases.map((item) => item.id));

  const latestInquiry = cases[0]
    ? classifyImmigrationInquiry({ situation: cases[0].situation, goal: cases[0].goal })
    : { mode: "open_options" as const };
  const listCopy = resolveCasesListCopy({ inquiryMode: latestInquiry.mode });
  const intake = resolveIntakeChrome({ inquiryMode: latestInquiry.mode });

  return (
    <div>
      <PageHeader
        title={listCopy.pageTitle}
        subtitle={listCopy.pageSubtitle}
        actions={<ButtonLink href="/app/cases/new">{intake.listCta}</ButtonLink>}
      />
      {cases.length === 0 ? (
        <EmptyState
          title={listCopy.emptyTitle}
          body={listCopy.emptyBody}
          action={<ButtonLink href="/app/cases/new">{listCopy.startLabel}</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <CaseListCard
              key={c.id}
              href={`/app/cases/${c.id}`}
              number={c.number}
              title={c.title}
              status={c.status}
              readinessScore={c.readinessScore}
              readinessLabel={resolveReadinessCopy({
                inquiryMode: classifyImmigrationInquiry({ situation: c.situation, goal: c.goal }).mode,
                query: `${c.situation} ${c.goal}`,
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
  );
}
