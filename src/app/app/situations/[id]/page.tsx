import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { SituationWorkspaceView } from "@/components/situation-workspace-view";

export default async function SituationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const row = await db.situation.findFirst({
    where: { id, userId: user.id },
  });
  if (!row) notFound();

  return (
    <SituationWorkspaceView
      number={row.number}
      title={row.title}
      originalNarrative={row.originalNarrative}
      goal={row.goal}
      assistantReply={row.assistantReply}
      intelligenceJson={row.intelligenceJson}
      createdAt={row.createdAt}
    />
  );
}
