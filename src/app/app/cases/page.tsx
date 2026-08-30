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

export async function generateMetadata() {
  return { title: resolveCasesListCopy({ inquiryMode: "existing_case" }).pageTitle };
}

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { reconstruction: { select: { currentPosition: true } } },
  });
  const views = await loadApprovedViewsByCaseIds(cases.map((item) => item.id));

  // Cases list is always the government-matter surface (Situation list is /app/situations).
  const listCopy = resolveCasesListCopy({ inquiryMode: "existing_case" });
  const intake = resolveIntakeChrome({ inquiryMode: "existing_case" });

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
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/app/cases/new">{listCopy.startLabel}</ButtonLink>
              <ButtonLink href="/app/situations" variant="secondary">
                View my situations
              </ButtonLink>
            </div>
          }
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
