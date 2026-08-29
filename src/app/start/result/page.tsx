import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getGuestSession } from "@/lib/guest";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { Card, CardBody, StateMark, ButtonLink, Badge } from "@/components/ui";
import { resolveCasePresentation } from "@/lib/case-presentation";
import { loadSuggestionAccess } from "@/lib/suggestion-quota";
import { suggestionConsultantCopy } from "@/lib/suggestion-access";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { isFiledCaseSurface } from "@/lib/goal-notices";

export const metadata = { title: "Your first results" };

export default async function GuestResultPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await getCurrentUser();
  if (user && caseId) redirect(`/app/cases/${caseId}`);
  const guest = await getGuestSession();
  if (!caseId || !guest) redirect("/start");

  const c = await db.case.findFirst({
    where: { id: caseId, guestSessionId: guest.id },
    include: { issues: { orderBy: { createdAt: "asc" } }, documents: { where: { deletedAt: null } } },
  });
  if (!c) redirect("/start");

  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const filed = isFiledCaseSurface({ inquiryMode: inquiry.mode, query: `${c.situation} ${c.goal}` });

  // The analysis runs in the background after intake — show a live-refreshing
  // waiting state until findings are ready.
  if (c.status === "analyzing" && Date.now() - c.updatedAt.getTime() < 10 * 60000) {
    const { AutoRefresh } = await import("@/components/auto-refresh");
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-24 text-center">
          <span className="mx-auto block h-4 w-4 animate-ping rounded-full bg-lime-500" />
          <h1 className="mt-6 text-2xl font-extrabold text-slate-900">{filed ? "Analyzing your case…" : "Analyzing your situation…"}</h1>
          <p className="mt-2 text-slate-600">
            We&apos;re reading your summary and goal{c.documents.length ? ", and any documents you uploaded" : ""}. This page updates automatically — most analyses finish in
            under a minute.
          </p>
          <AutoRefresh />
        </main>
        <SiteFooter />
      </div>
    );
  }

  // Teaser: show the count, the first issue, and one official next step. Full path requires registration.
  const [first, ...locked] = c.issues;
  const presentation = await resolveCasePresentation(c.id).catch(() => null);
  const suggestionAccess = await loadSuggestionAccess({});
  const nextStep = presentation?.hero.next_best_action?.title || null;
  const consultantCopy = suggestionConsultantCopy(
    suggestionAccess.entitlement,
    null,
    Boolean(presentation?.hero.professional_review_recommended),
    { inquiryMode: inquiry.mode, query: `${c.situation} ${c.goal}` },
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <div className="text-center">
          <Badge color="green">Analysis complete</Badge>
          <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
            We found {c.issues.length} {c.issues.length === 1 ? "thing" : "things"} worth looking at
          </h1>
          <p className="mt-2 text-slate-600">Here&apos;s your first result and the next official step. Create a free account to keep the review, and paid plans unlock the full suggested path.</p>
        </div>

        {first && (
          <Card className="mt-8">
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {first.caseYear ? `${first.caseYear} · ` : ""}{first.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{first.description}</p>
                </div>
                <StateMark state={first.state} />
              </div>
            </CardBody>
          </Card>
        )}

        {nextStep && (
          <Card className="mt-4 border-lime-200">
            <CardBody>
              <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Suggested next step</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{nextStep}</p>
              <p className="mt-2 text-sm text-slate-600">{consultantCopy}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink href={`/register?next=${encodeURIComponent(`/app/cases/${c.id}`)}`} className="px-4 py-2 text-sm">Create a free account</ButtonLink>
                <Link href={`/register?next=${encodeURIComponent(`/app/cases/${c.id}`)}`} className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                  Talk with a licensed professional
                </Link>
              </div>
            </CardBody>
          </Card>
        )}

        {locked.length > 0 && (
          <div className="relative mt-4">
            <div className="pointer-events-none select-none space-y-4 blur-sm">
              {locked.map((issue) => (
                <Card key={issue.id}>
                  <CardBody>
                    <h2 className="text-lg font-semibold text-slate-900">{issue.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">{issue.description.slice(0, 120)}…</p>
                  </CardBody>
                </Card>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl bg-white/95 px-6 py-4 text-center shadow-lg ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">{locked.length} more {locked.length === 1 ? "result" : "results"} + the rest of your suggested path</p>
                <p className="text-sm text-slate-500">Free keeps a little more. Plus personalizes the full official path. Pro can match a licensed professional.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-lime-600 p-8 text-center text-white">
          <h2 className="text-xl font-bold">Unlock your full analysis</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-lime-100">
            Your answers and {c.documents.length > 0 ? `${c.documents.length} uploaded document${c.documents.length > 1 ? "s" : ""}` : "results"} will be attached to your account automatically — nothing is lost. Paid plans keep the full suggested path, and Pro can match you with a licensed attorney or accredited representative.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <ButtonLink href={`/register?next=${encodeURIComponent(`/app/cases/${c.id}`)}`} variant="secondary" className="px-6 py-3">Create free account</ButtonLink>
            <Link href={`/login?next=${encodeURIComponent(`/app/cases/${c.id}`)}`} className="inline-flex items-center px-4 text-sm font-medium text-lime-100 underline hover:text-white">
              I already have one
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
