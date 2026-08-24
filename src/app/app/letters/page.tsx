import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { loadPresentationsByCaseIds } from "@/lib/case-presentation";
import { caseListSummary, caseListActionLine } from "@/lib/case-presentation-list";

export const metadata = { title: "Response letters" };

export default async function LettersPage() {
  const user = await requireUser();
  const letters = await db.responseLetter.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { case: { select: { id: true, status: true, actionReadinessScore: true, title: true } } },
  });
  const presentations = await loadPresentationsByCaseIds(letters.map((letter) => letter.caseId).filter((id): id is string => Boolean(id)));

  return (
    <div>
      <PageHeader
        title="Response letters"
        subtitle="Professional drafts grounded in the approved case presentation. Edit, print, and mail them yourself."
        actions={<ButtonLink href="/app/letters/new">New letter →</ButtonLink>}
      />
      {letters.length === 0 ? (
        <EmptyState
          title="No letters yet"
          body="Generate a response to an USCIS notice, then fine-tune every word before sending."
          action={<ButtonLink href="/app/letters/new">Draft your first letter</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {letters.map((l) => {
            const summary = l.case
              ? caseListSummary({
                  status: l.case.status,
                  actionReadinessScore: l.case.actionReadinessScore,
                  presentation: presentations.get(l.case.id) ?? null,
                })
              : null;
            return (
            <Link key={l.id} href={`/app/letters/${l.id}`} className="block">
              <Card className="transition hover:border-lime-300">
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{l.title}</p>
                    {summary && (
                      <p className="mt-1 text-xs text-slate-600">
                        {l.case?.title}: {summary.posture} · {caseListActionLine(summary)}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">Updated {l.updatedAt.toLocaleDateString("en-US")}</p>
                  </div>
                  <Badge color={l.status === "final" ? "green" : "slate"}>{l.status}</Badge>
                </CardBody>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
