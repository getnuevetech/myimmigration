import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { getActivePlan, hasFeature, featureLimit } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView, caseListActionLine } from "@/lib/case-presentation-list";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import {
  LETTER_CATALOG,
  letterComposerHref,
  letterGenerationAllowed,
  letterStartLabel,
  rankLetterCatalog,
  rankMatchingLetters,
  resolveLetterCatalogEntitlement,
} from "@/lib/goal-letters";

export const metadata = { title: "USCIS letters" };

export default async function LettersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; case?: string }>;
}) {
  const { kind: requestedKind, case: caseId } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const staff = isAdmin(user);
  const hasLetters = staff || (await hasFeature(user.id, FEATURE_KEYS.LETTERS));
  const entitlement = resolveLetterCatalogEntitlement({
    isStaff: staff,
    planKey: plan?.key,
    hasLetters,
  });
  const [letters, scopedCase, used, limit] = await Promise.all([
    db.responseLetter.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { case: { select: { id: true, status: true, actionReadinessScore: true, title: true } } },
    }),
    caseId
      ? db.case.findFirst({
          where: { id: caseId, userId: user.id },
          select: {
            id: true,
            situation: true,
            goal: true,
            issues: { select: { title: true, uscisBasis: true, conclusion: true } },
            notices: { select: { noticeType: true } },
          },
        })
      : db.case.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            situation: true,
            goal: true,
            issues: { select: { title: true, uscisBasis: true, conclusion: true } },
            notices: { select: { noticeType: true } },
          },
        }),
    db.responseLetter.count({ where: { userId: user.id } }),
    staff ? Promise.resolve(null) : featureLimit(user.id, FEATURE_KEYS.LETTERS),
  ]);
  const quota = letterGenerationAllowed({
    canGenerate: entitlement.canGenerate,
    used,
    limit: entitlement.canGenerate ? limit : 0,
  });
  const views = await loadApprovedViewsByCaseIds(letters.map((letter) => letter.caseId).filter((id): id is string => Boolean(id)));
  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const ranked = inquiry
    ? rankMatchingLetters({
        themes: inquiry.themes,
        inquiryMode: inquiry.mode,
        query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
        authorityQueries: authorityQueriesForInquiry(inquiry),
        sources: (scopedCase?.issues ?? []).map((issue) => ({
          reference: issue.uscisBasis,
          title: issue.title,
          content: issue.conclusion,
        })),
        noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
      })
    : [];
  const bestMatch = requestedKind || ranked[0]?.kind;
  const catalog = rankLetterCatalog(LETTER_CATALOG, ranked);
  const canStart = quota.allowed;
  const newHref = canStart
    ? letterComposerHref({ caseId: scopedCase?.id, kind: bestMatch })
    : "/app/billing?upgrade=letters";

  return (
    <div>
      <PageHeader
        title="USCIS letters, matched to your case"
        subtitle="Cover letters for the matching official form, or notice responses when a receipt is actually on file. Matching kinds come from official material on your latest case, not a generic RFE reply."
        actions={<ButtonLink href={newHref}>{canStart ? "New letter →" : "Unlock with Plus →"}</ButtonLink>}
      />

      {entitlement.showUpgradeCta && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          The matching letter is highlighted. Drafting it is included in Plus.{" "}
          <Link href="/app/billing?upgrade=letters" className="font-semibold underline">Upgrade to Plus →</Link>
        </div>
      )}
      {quota.overLimit && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          You&apos;ve used all {limit} letters included in Plus.{" "}
          <Link href="/app/billing?upgrade=letters" className="font-semibold underline">Upgrade to Pro for unlimited letters →</Link>
        </div>
      )}
      {canStart && quota.remaining !== null && (
        <p className="mb-4 text-xs text-slate-500">{quota.remaining} letter{quota.remaining === 1 ? "" : "s"} remaining on Plus.</p>
      )}

      {letters.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Continue where you left off</h2>
          <div className="space-y-3">
            {letters.map((l) => {
              const summary = l.case
                ? caseListSummaryFromView(
                    {
                      status: l.case.status,
                      actionReadinessScore: l.case.actionReadinessScore,
                    },
                    views.get(l.case.id),
                  )
                : null;
              return (
                <Link key={l.id} href={`/app/letters/${l.id}`} className="block">
                  <Card className="transition hover:border-lime-300">
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{l.title}</p>
                        {summary && (
                          <p className="mt-1 text-xs text-slate-600">
                            {l.case?.title}: {summary.posture} · {caseListActionLine(summary)}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">Updated {l.updatedAt.toLocaleDateString("en-US")}</p>
                      </div>
                      <Badge color={l.status === "final" ? "green" : "slate"}>{l.status}</Badge>
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Available letters</h2>
      {catalog.length === 0 ? (
        <EmptyState title="No letter kinds yet" body="Matching USCIS cover letters and notice responses will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.map((item) => {
            const isBest = bestMatch != null && item.kind === String(bestMatch);
            const href = canStart
              ? letterComposerHref({ caseId: scopedCase?.id, kind: item.kind })
              : "/app/billing?upgrade=letters";
            return (
              <Card key={item.kind} className={`transition ${isBest ? "border-lime-400 ring-1 ring-lime-200" : "hover:border-lime-300"}`}>
                <CardBody>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-slate-900">{item.title}</p>
                    <div className="flex flex-wrap justify-end gap-1">
                      {isBest && <Badge color="lime">Best match</Badge>}
                      <Badge>{item.isNoticeResponse ? "Notice" : "Cover letter"}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  <Link
                    href={href}
                    className={`mt-4 block w-full rounded-lg px-4 py-2 text-center text-sm font-semibold text-white ${canStart ? "bg-lime-600 hover:bg-lime-700" : "bg-slate-800 hover:bg-slate-900"}`}
                  >
                    {canStart
                      ? (isBest ? `${letterStartLabel(item.kind)} →` : "Start this letter →")
                      : quota.overLimit
                        ? (isBest ? "Upgrade to Pro for unlimited letters →" : "Upgrade to Pro →")
                        : (isBest ? `Unlock ${item.title} with Plus →` : "Unlock with Plus →")}
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
