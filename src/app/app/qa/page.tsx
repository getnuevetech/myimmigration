import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "Ask the assistant" };

export default async function QaPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { userId: user.id, status: { notIn: ["closed"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, number: true, status: true, actionReadinessScore: true },
    take: 50,
  });
  const linkedCase = caseId ? cases.find((c) => c.id === caseId) ?? null : null;
  const views = await loadApprovedViewsByCaseIds(linkedCase ? [linkedCase.id] : []);
  const summary = linkedCase
    ? caseListSummaryFromView(
        {
          status: linkedCase.status,
          actionReadinessScore: linkedCase.actionReadinessScore,
        },
        views.get(linkedCase.id),
      )
    : null;
  const threads = await db.qaThread.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        title={linkedCase ? `Ask about ${linkedCase.title}` : "Ask the assistant"}
        subtitle={
          linkedCase
            ? "This conversation is grounded in the approved case presentation and compiled evidence."
            : "Plain-English answers about your immigration case. Link a case to ground answers in the approved presentation."
        }
      />
      {summary && <CasePresentationContextCard heading="Answers use this approved presentation" summary={summary} />}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {cases.length > 0 && (
            <form className="mb-4" action="/app/qa" method="get">
              <label className="block text-sm font-medium text-slate-700">
                Ground answers in a case
                <select
                  name="case"
                  defaultValue={linkedCase?.id ?? ""}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">General immigration questions</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{formatCaseNumber(c.number)} · {c.title}</option>
                  ))}
                </select>
              </label>
              <button className="mt-2 text-sm font-medium text-lime-700 hover:text-lime-800">Apply →</button>
            </form>
          )}
          <QaChat threadId="" caseId={linkedCase?.id ?? ""} messages={[]} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent conversations</h2>
          <div className="space-y-2">
            {threads.length === 0 && <p className="text-sm text-slate-400">No conversations yet.</p>}
            {threads.map((t) => (
              <Link key={t.id} href={`/app/qa/${t.id}`} className="block">
                <Card className="transition hover:border-lime-300">
                  <CardBody className="!p-3">
                    <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-400">{t.createdAt.toLocaleDateString("en-US")}</p>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
