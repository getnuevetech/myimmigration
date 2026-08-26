import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QaChat } from "@/components/qa-chat";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";
import { loadQaAccess } from "@/lib/qa-quota";
import { toQaChatAccess } from "@/lib/qa-access";
import { conversationNarrative } from "@/lib/goal-suggestions";
import { matchInputFromCase } from "@/lib/goal-versions";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { previewBestConsultantForThemes } from "@/lib/matching";

export default async function QaThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const thread = await db.qaThread.findFirst({
    where: { id, userId: user.id },
    include: {
      case: { select: { id: true, title: true, status: true, actionReadinessScore: true, situation: true, goal: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) notFound();
  const access = await loadQaAccess({ userId: user.id });
  let consultantName: string | null = null;
  if (access.entitlement.consultantReferral) {
    const narrative = conversationNarrative(thread.messages);
    const inquiry = classifyImmigrationInquiry({ situation: narrative, goal: narrative });
    const preview = await previewBestConsultantForThemes(inquiry.themes).catch(() => null);
    consultantName = preview ? `${preview.name}, ${preview.credentialLabel}` : null;
  }
  const views = thread.caseId ? await loadApprovedViewsByCaseIds([thread.caseId]) : new Map();
  const summary = thread.case
    ? caseListSummaryFromView(
        {
          status: thread.case.status,
          actionReadinessScore: thread.case.actionReadinessScore,
        },
        views.get(thread.case.id),
        matchInputFromCase(thread.case),
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
        access={toQaChatAccess(access.entitlement, access.usage, consultantName, Boolean(thread.caseId))}
      />
    </div>
  );
}
