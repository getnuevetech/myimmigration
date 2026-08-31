import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, ButtonLink, EmptyState, Card, CardBody, Badge } from "@/components/ui";
import { formatSituationNumber } from "@/lib/situation";
import { resolveIntakeChrome } from "@/lib/goal-intake";

export const metadata = { title: "My situations" };

export default async function SituationsListPage() {
  const user = await requireUser();
  const intake = resolveIntakeChrome({});
  let situations: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    goal: string;
    originalNarrative: string;
    updatedAt: Date;
    filingPlans: { id: string }[];
  }> = [];
  let loadError = false;
  try {
    situations = await db.situation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { filingPlans: { select: { id: true }, take: 1 } },
    });
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="My situations"
        subtitle="Personal immigration questions and pathway reviews — not USCIS Cases until a government matter exists."
        actions={<ButtonLink href="/app/cases/new">{intake.listCta}</ButtonLink>}
      />
      {loadError ? (
        <EmptyState
          title="Situations temporarily unavailable"
          body="We could not load your Situations. If this continues after a refresh, the host may need to run database migrations (Situation table)."
          action={<ButtonLink href="/app">Back to overview</ButtonLink>}
        />
      ) : situations.length === 0 ? (
        <EmptyState
          title="No situations yet"
          body="Describe your situation and goal, even if you have not filed anything with USCIS, and we'll map options and next steps."
          action={<ButtonLink href="/app/cases/new">{intake.startLabel}</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {situations.map((s) => (
            <Link key={s.id} href={`/app/situations/${s.id}`} className="block">
              <Card className="transition hover:border-lime-300">
                <CardBody>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      <span className="mr-2 font-mono text-xs text-lime-600">{formatSituationNumber(s.number)}</span>
                      {s.title}
                    </p>
                    <Badge color={s.status === "filing_plan" ? "lime" : "slate"}>
                      {s.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {s.goal || s.originalNarrative || "Immigration situation"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Updated {s.updatedAt.toLocaleString("en-US")}
                    {s.filingPlans[0] ? " · Filing plan started" : ""}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
