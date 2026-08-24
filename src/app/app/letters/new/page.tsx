import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewLetterForm } from "@/components/letter-forms";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "Draft a response letter" };

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; case?: string }>;
}) {
  const { notice: noticeId, case: caseId } = await searchParams;
  const user = await requireUser();
  const [notices, cases] = await Promise.all([
    db.notice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, noticeType: true, caseYear: true, caseId: true },
    }),
    db.case.findMany({
      where: { userId: user.id, status: { notIn: ["closed"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, title: true, status: true, actionReadinessScore: true },
      take: 50,
    }),
  ]);
  const linkedFromNotice = noticeId ? notices.find((n) => n.id === noticeId)?.caseId : null;
  const defaultCaseId = cases.some((c) => c.id === caseId)
    ? caseId ?? ""
    : cases.some((c) => c.id === linkedFromNotice)
      ? linkedFromNotice ?? ""
      : "";
  const views = await loadApprovedViewsByCaseIds(defaultCaseId ? [defaultCaseId] : []);
  const selected = cases.find((c) => c.id === defaultCaseId) ?? null;
  const summary = selected
    ? caseListSummaryFromView(
        {
          status: selected.status,
          actionReadinessScore: selected.actionReadinessScore,
        },
        views.get(selected.id),
      )
    : null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Draft a response letter"
        subtitle="Tell us what the letter should say. We'll produce a professional draft from the approved case presentation that you can edit before mailing it yourself."
      />
      {cases.length > 0 && (
        <form className="mb-4" action="/app/letters/new" method="get">
          {noticeId ? <input type="hidden" name="notice" value={noticeId} /> : null}
          <label className="block text-sm font-medium text-slate-700">
            Ground this letter in a case
            <select
              name="case"
              defaultValue={defaultCaseId}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Not linked to a case</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{formatCaseNumber(c.number)} · {c.title}</option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-slate-500">The draft uses the approved posture, next action, and deadlines from this case.</p>
          <button className="mt-2 text-sm font-medium text-lime-700 hover:text-lime-800">Apply →</button>
        </form>
      )}
      {summary && <CasePresentationContextCard summary={summary} />}
      <NewLetterForm
        notices={notices.map((n) => ({ id: n.id, label: `${n.noticeType || "Notice"}${n.caseYear ? ` · ${n.caseYear}` : ""}` }))}
        defaultNoticeId={noticeId ?? ""}
        defaultCaseId={defaultCaseId}
      />
    </div>
  );
}
