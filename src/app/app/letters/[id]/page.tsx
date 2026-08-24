import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { EditLetterForm } from "@/components/letter-forms";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const letter = await db.responseLetter.findFirst({
    where: { id, userId: user.id },
    include: { case: { select: { id: true, status: true, actionReadinessScore: true } } },
  });
  if (!letter) notFound();
  const views = letter.caseId ? await loadApprovedViewsByCaseIds([letter.caseId]) : new Map();
  const summary = letter.case
    ? caseListSummaryFromView(
        {
          status: letter.case.status,
          actionReadinessScore: letter.case.actionReadinessScore,
        },
        views.get(letter.case.id),
      )
    : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Edit your letter"
        subtitle="Review every word against the approved case presentation. You are the sender — mail it when you're confident it's right."
      />
      {summary && <CasePresentationContextCard heading="This letter is grounded in" summary={summary} />}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <EditLetterForm letter={{ id: letter.id, title: letter.title, body: letter.body, status: letter.status }} />
      </div>
    </div>
  );
}
