import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { loadPresentationsByCaseIds } from "@/lib/case-presentation";
import { caseListSummary } from "@/lib/case-presentation-list";
import { CaseListCard } from "@/components/case-list-card";

export const metadata = { title: "My cases" };

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { reconstruction: { select: { currentPosition: true } } },
  });
  const presentations = await loadPresentationsByCaseIds(cases.map((item) => item.id));

  return (
    <div>
      <PageHeader
        title="My cases"
        subtitle="Each case is one immigration situation, with a current posture and next step."
        actions={<ButtonLink href="/app/cases/new">New case →</ButtonLink>}
      />
      {cases.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="Describe your situation and goal, and we'll analyze it into a clear case plan."
          action={<ButtonLink href="/app/cases/new">Start a case</ButtonLink>}
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
              summary={caseListSummary({
                status: c.status,
                actionReadinessScore: c.actionReadinessScore,
                presentation: presentations.get(c.id) ?? null,
                reconstructionPosition: c.reconstruction?.currentPosition,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
