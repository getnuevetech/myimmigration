import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";

export default async function QaThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const thread = await db.qaThread.findFirst({
    where: { id, userId: user.id },
    include: {
      case: { select: { id: true, title: true, status: true, actionReadinessScore: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) notFound();
  const views = thread.caseId ? await loadApprovedViewsByCaseIds([thread.caseId]) : new Map();
  const summary = thread.case
    ? caseListSummaryFromView(
        {
          status: thread.case.status,
          actionReadinessScore: thread.case.actionReadinessScore,
        },
        views.get(thread.case.id),
      )
    : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={thread.title}
        subtitle={thread.case ? `Grounded in the approved presentation for ${thread.case.title}` : undefined}
      />
      {summary && <CasePresentationContextCard heading="Answers use this approved presentation" summary={summary} />}
      <QaChat
        threadId={thread.id}
        caseId={thread.caseId ?? ""}
        messages={thread.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))}
      />
    </div>
  );
}
