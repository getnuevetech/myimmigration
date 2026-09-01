import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuestSession } from "@/lib/guest";
import { SituationWorkspaceView } from "@/components/situation-workspace-view";
import { ensureSituationAnalysisPersisted } from "@/lib/situation-intelligence";

export default async function GuestSituationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) notFound();
  const guest = await getOrCreateGuestSession();
  await ensureSituationAnalysisPersisted(id).catch(() => null);
  const row = await db.situation.findFirst({
    where: { id, guestSessionId: guest.id },
    include: { filingPlans: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <SituationWorkspaceView
        id={row.id}
        number={row.number}
        title={row.title}
        originalNarrative={row.originalNarrative}
        goal={row.goal}
        assistantReply={row.assistantReply}
        intelligenceJson={row.intelligenceJson}
        currentPathwaysJson={row.currentPathwaysJson}
        knownFactsJson={row.knownFactsJson}
        createdAt={row.createdAt}
        existingFilingPlanId={row.filingPlans[0]?.id ?? null}
        isGuest
        canBuildFilingPlan={false}
        filingPlanBlockedReason="guest"
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
