import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink } from "@/components/ui";
import { NoticeUpload } from "@/components/notice-upload";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView, caseListActionLine, caseListEvidenceLine } from "@/lib/case-presentation-list";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "USCIS notices" };

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await requireUser();
  const [notices, cases] = await Promise.all([
    db.notice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { case: { select: { id: true, title: true, status: true, actionReadinessScore: true } } },
    }),
    db.case.findMany({
      where: { userId: user.id, status: { notIn: ["closed"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, number: true, title: true },
      take: 50,
    }),
  ]);
  const defaultCaseId = cases.some((c) => c.id === caseId) ? caseId ?? "" : "";
  const views = await loadApprovedViewsByCaseIds(
    notices.map((n) => n.caseId).filter((id): id is string => Boolean(id)),
  );

  return (
    <div>
      <PageHeader
        title="USCIS notices"
        subtitle="Upload or photograph any USCIS letter. We identify it, extract the key facts, and explain it against the approved case presentation."
      />
      <Card className="mb-6">
        <CardBody>
          <NoticeUpload
            cases={cases.map((c) => ({ id: c.id, label: `${formatCaseNumber(c.number)} · ${c.title}` }))}
            defaultCaseId={defaultCaseId}
          />
        </CardBody>
      </Card>

      {notices.length === 0 ? (
        <EmptyState title="No notices yet" body="When you upload an USCIS letter, its explanation will appear here." />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => {
            const steps: { title: string; description: string }[] = JSON.parse(n.nextStepsJson || "[]");
            const summary = n.case
              ? caseListSummaryFromView(
                  {
                    status: n.case.status,
                    actionReadinessScore: n.case.actionReadinessScore,
                  },
                  views.get(n.case.id),
                )
              : null;
            return (
              <Card key={n.id}>
                <CardBody>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {n.noticeType ? `Notice ${n.noticeType}` : "USCIS notice"}
                      {n.caseYear ? ` · Year ${n.caseYear}` : ""}
                    </h2>
                    <div className="flex gap-2">
                      {n.deadline && (
                        <Badge color="red">Respond by {n.deadline.toLocaleDateString("en-US")}</Badge>
                      )}
                      <Badge color={n.status === "explained" ? "green" : "slate"}>{n.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  {summary && (
                    <div className="mt-3 rounded-xl border border-lime-200 bg-lime-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-lime-700">How this fits your case</p>
                      <p className="mt-1 text-sm font-medium text-lime-950">{n.case?.title}: {summary.posture}</p>
                      <p className="mt-0.5 text-sm text-lime-900">{caseListActionLine(summary)}</p>
                      <p className="mt-0.5 text-xs text-lime-800">{caseListEvidenceLine(summary)}</p>
                    </div>
                  )}
                  {n.explanation && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What this means</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.explanation}</p>
                    </div>
                  )}
                  {steps.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your next steps</p>
                      <ol className="mt-2 space-y-2">
                        {steps.map((s, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime-100 text-xs font-bold text-lime-700">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{s.title}</p>
                              <p className="text-slate-500">{s.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <ButtonLink href={`/app/letters/new?notice=${n.id}${n.caseId ? `&case=${n.caseId}` : ""}`} variant="secondary" className="!px-3 !py-1.5 text-xs">
                      Draft a response letter
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
