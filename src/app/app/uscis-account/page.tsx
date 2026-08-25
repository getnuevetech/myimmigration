import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, ButtonLink } from "@/components/ui";
import { getSetting } from "@/lib/settings";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { matchingEvidenceHref, resolveUscisAccountCopy } from "@/lib/goal-notices";

export const metadata = { title: "Your USCIS online account" };

export default async function UscisAccountPage() {
  const user = await requireUser();
  const [uscisUrl, scopedCase] = await Promise.all([
    getSetting("uscis.account_url", "https://my.uscis.gov/"),
    db.case.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        situation: true,
        goal: true,
        issues: { select: { title: true, uscisBasis: true, conclusion: true } },
        notices: { select: { noticeType: true } },
      },
    }),
  ]);
  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const copy = resolveUscisAccountCopy({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
    authorityQueries: inquiry ? authorityQueriesForInquiry(inquiry) : [],
    sources: (scopedCase?.issues ?? []).map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
    hasNotices: (scopedCase?.notices.length ?? 0) > 0,
  });
  const evidenceHref = matchingEvidenceHref({
    themes: inquiry?.themes,
    inquiryMode: inquiry?.mode,
    query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
    authorityQueries: inquiry ? authorityQueriesForInquiry(inquiry) : [],
    noticeTypes: (scopedCase?.notices ?? []).map((notice) => notice.noticeType),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title={copy.pageTitle} subtitle={copy.pageSubtitle} />
      {copy.optionalBanner && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          {copy.optionalBanner}{" "}
          <Link href={evidenceHref} className="font-semibold underline">Upload matching documents →</Link>
        </div>
      )}
      <Card className="mb-6">
        <CardBody>
          <p className="text-sm leading-relaxed text-slate-600">{copy.intro}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.showGuidePrimary ? (
              <a
                href={uscisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-lime-700"
              >
                Open the official USCIS account page ↗
              </a>
            ) : (
              <ButtonLink href={evidenceHref}>Upload matching documents →</ButtonLink>
            )}
            {!copy.showGuidePrimary && (
              <a
                href={uscisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Official USCIS account ↗
              </a>
            )}
          </div>
        </CardBody>
      </Card>
      <div className="space-y-3">
        {copy.steps.map((s, i) => (
          <Card key={i}>
            <CardBody className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime-100 text-sm font-bold text-lime-700">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{s.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{s.body}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
