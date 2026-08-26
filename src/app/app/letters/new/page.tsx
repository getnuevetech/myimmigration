import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { featureLimit, getActivePlan, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { NewLetterForm } from "@/components/letter-forms";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CasePresentationContextCard } from "@/components/case-list-card";
import { matchInputFromCase } from "@/lib/goal-versions";
import { resolveIntakeChrome } from "@/lib/goal-intake";
import { approvedPresentationHeading, letterComposerGroundingCopy } from "@/lib/case-presentation-contract";
import { formatCaseNumber } from "@/lib/case-number";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import {
  LETTER_CATALOG,
  letterGenerationAllowed,
  letterKindDef,
  letterKindFromNoticeType,
  letterStartLabel,
  normalizeLetterKind,
  rankLetterCatalog,
  rankMatchingLetters,
  resolveLetterCatalogEntitlement,
  letterKindHint,
  letterGroundSelectLabel,
  letterUnlinkedOption,
} from "@/lib/goal-letters";

export const metadata = { title: "Draft a USCIS letter" };

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; case?: string; kind?: string }>;
}) {
  const { notice: noticeId, case: caseId, kind: requestedKind } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const staff = isAdmin(user);
  const hasLetters = staff || (await hasFeature(user.id, FEATURE_KEYS.LETTERS));
  const entitlement = resolveLetterCatalogEntitlement({
    isStaff: staff,
    planKey: plan?.key,
    hasLetters,
  });
  const [notices, cases, used, limit] = await Promise.all([
    db.notice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, noticeType: true, caseYear: true, caseId: true },
    }),
    db.case.findMany({
      where: { userId: user.id, status: { notIn: ["closed"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        actionReadinessScore: true,
        situation: true,
        goal: true,
        issues: { select: { title: true, uscisBasis: true, conclusion: true } },
      },
      take: 50,
    }),
    db.responseLetter.count({ where: { userId: user.id } }),
    staff ? Promise.resolve(null) : featureLimit(user.id, FEATURE_KEYS.LETTERS),
  ]);
  const quota = letterGenerationAllowed({
    canGenerate: entitlement.canGenerate,
    used,
    limit: entitlement.canGenerate ? limit : 0,
  });
  const linkedFromNotice = noticeId ? notices.find((n) => n.id === noticeId)?.caseId : null;
  const defaultCaseId = cases.some((c) => c.id === caseId)
    ? caseId ?? ""
    : cases.some((c) => c.id === linkedFromNotice)
      ? linkedFromNotice ?? ""
      : "";
  const selected = cases.find((c) => c.id === defaultCaseId) ?? null;
  const views = await loadApprovedViewsByCaseIds(defaultCaseId ? [defaultCaseId] : []);
  const summary = selected
    ? caseListSummaryFromView(
        {
          status: selected.status,
          actionReadinessScore: selected.actionReadinessScore,
        },
        views.get(selected.id),
        matchInputFromCase(selected),
      )
    : null;
  const inquiry = selected
    ? classifyImmigrationInquiry({ situation: selected.situation, goal: selected.goal })
    : null;
  const ranked = inquiry
    ? rankMatchingLetters({
        themes: inquiry.themes,
        inquiryMode: inquiry.mode,
        query: `${selected?.situation ?? ""} ${selected?.goal ?? ""}`,
        authorityQueries: authorityQueriesForInquiry(inquiry),
        sources: (selected?.issues ?? []).map((issue) => ({
          reference: issue.uscisBasis,
          title: issue.title,
          content: issue.conclusion,
        })),
        noticeTypes: notices.filter((notice) => !defaultCaseId || notice.caseId === defaultCaseId).map((notice) => notice.noticeType),
      })
    : [];
  const noticeKind = noticeId
    ? letterKindFromNoticeType(notices.find((n) => n.id === noticeId)?.noticeType)
    : null;
  const defaultKind = normalizeLetterKind(requestedKind) || (noticeId ? noticeKind : ranked[0]?.kind) || ranked[0]?.kind || "i130_cover";
  const kinds = rankLetterCatalog(LETTER_CATALOG, ranked);
  const def = letterKindDef(defaultKind);
  const relatedNotices = notices.filter((n) => !defaultCaseId || !n.caseId || n.caseId === defaultCaseId);
  const defaultNoticeId = def?.isNoticeResponse ? noticeId ?? "" : "";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={letterStartLabel(defaultKind)}
        subtitle={letterComposerGroundingCopy(selected ? matchInputFromCase(selected) : undefined)}
      />
      {cases.length > 0 && (
        <form className="mb-4" action="/app/letters/new" method="get">
          {noticeId ? <input type="hidden" name="notice" value={noticeId} /> : null}
          <input type="hidden" name="kind" value={defaultKind} />
          <label className="block text-sm font-medium text-slate-700">
            {letterGroundSelectLabel(selected ? matchInputFromCase(selected) : undefined)}
            <select
              name="case"
              defaultValue={defaultCaseId}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">{letterUnlinkedOption(selected ? matchInputFromCase(selected) : undefined)}</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>{formatCaseNumber(c.number)} · {c.title}</option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-slate-500">{resolveIntakeChrome(selected ? matchInputFromCase(selected) : undefined).letterGroundHint}</p>
          <button className="mt-2 text-sm font-medium text-lime-700 hover:text-lime-800">Apply →</button>
        </form>
      )}
      {summary && (
        <CasePresentationContextCard
          heading={approvedPresentationHeading(selected ? matchInputFromCase(selected) : undefined)}
          summary={summary}
        />
      )}
      {!quota.allowed ? (
        <div className="rounded-2xl border border-lime-200 bg-lime-50 p-6 text-sm text-lime-900">
          <p className="font-semibold">
            {quota.overLimit
              ? "You've used all letters included in Plus."
              : `Unlock ${def?.title ?? "this letter"} with Plus.`}
          </p>
          <p className="mt-2">
            Free highlights the matching letter from official material. Plus drafts it. Pro is unlimited.
          </p>
          <Link href="/app/billing?upgrade=letters" className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            {quota.overLimit ? "Upgrade to Pro →" : "Upgrade to Plus →"}
          </Link>
        </div>
      ) : (
        <NewLetterForm
          kinds={kinds.map((item) => ({
            kind: item.kind,
            title: item.title,
            isNoticeResponse: item.isNoticeResponse,
            placeholder: item.placeholder,
          }))}
          defaultKind={defaultKind}
          notices={relatedNotices.map((n) => ({ id: n.id, label: `${n.noticeType || "Notice"}${n.caseYear ? ` · ${n.caseYear}` : ""}` }))}
          defaultNoticeId={def?.isNoticeResponse ? defaultNoticeId : ""}
          defaultCaseId={defaultCaseId}
          kindHint={letterKindHint(selected ? matchInputFromCase(selected) : undefined)}
        />
      )}
    </div>
  );
}
