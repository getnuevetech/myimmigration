import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuestSession } from "@/lib/guest";
import { SituationWorkspaceView } from "@/components/situation-workspace-view";

export default async function GuestSituationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();
  const guest = await getOrCreateGuestSession();
  const row = await db.situation.findFirst({
    where: { id, guestSessionId: guest.id },
  });
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SituationWorkspaceView
        number={row.number}
        title={row.title}
        originalNarrative={row.originalNarrative}
        goal={row.goal}
        assistantReply={row.assistantReply}
        intelligenceJson={row.intelligenceJson}
        createdAt={row.createdAt}
      />
      <p className="mt-8 text-center text-sm text-slate-500">
        <a href="/register" className="font-medium text-lime-700 hover:underline">
          Create an account
        </a>{" "}
        to save this Situation and continue later.
      </p>
    </main>
  );
}
