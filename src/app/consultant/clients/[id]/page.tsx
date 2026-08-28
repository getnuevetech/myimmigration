import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, ProgressBar, EmptyState } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { loadApprovedViewsByCaseIds } from "@/lib/case-presentation";
import { caseListSummaryFromView } from "@/lib/case-presentation-list";
import { CaseListSummaryDetails } from "@/components/case-list-card";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { resolveReadinessCopy } from "@/lib/goal-readiness";
import { matchInputFromCase } from "@/lib/goal-versions";
import { resolveConsultantWorkspaceCopy } from "@/lib/goal-chrome";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const assignment = await db.consultantAssignment.findFirst({
    where: { id, consultantId: user.id, status: "active" },
    include: {
      user: {
        include: {
          cases: {
            include: { reconstruction: { select: { currentPosition: true } } },
            orderBy: { updatedAt: "desc" },
          },
          documents: { where: { deletedAt: null, docKind: { not: "avatar" } }, orderBy: { uploadedAt: "desc" } },
        },
      },
    },
  });
  if (!assignment) notFound();
  const client = assignment.user;
  const scopedCases = assignment.caseId
    ? client.cases.filter((item) => item.id === assignment.caseId)
    : client.cases;
  const scopedDocuments = assignment.caseId
    ? client.documents.filter((doc) => doc.caseId === assignment.caseId)
    : client.documents;
  const views = await loadApprovedViewsByCaseIds(scopedCases.map((item) => item.id));
  const workspace = resolveConsultantWorkspaceCopy(scopedCases.map((item) => matchInputFromCase(item)));

  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        subtitle={`${client.email}${client.phone ? ` · ${client.phone}` : ""} — shared with you under an active connection agreement`}
      />
      {client.bio && (
        <Card className="mb-6"><CardBody><p className="text-sm text-slate-600">{client.bio}</p></CardBody></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">{workspace.heading}</h2>
          {scopedCases.length === 0 ? (
            <EmptyState title={workspace.emptyTitle} />
          ) : (
            <div className="space-y-4">
              {scopedCases.map((c) => {
                const summary = caseListSummaryFromView(
                  {
                    status: c.status,
                    actionReadinessScore: c.actionReadinessScore,
                    reconstructionPosition: c.reconstruction?.currentPosition,
                  },
                  views.get(c.id),
                  matchInputFromCase(c),
                );
                return (
                <Card key={c.id}>
                  <CardBody>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        <span className="mr-2 font-mono text-xs text-lime-600">{formatCaseNumber(c.number)}</span>
                        {c.title}
                      </p>
                      <Badge>{c.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <CaseListSummaryDetails summary={summary} />
                    <div className="mt-3"><ProgressBar value={c.readinessScore} label={resolveReadinessCopy({
                      inquiryMode: classifyImmigrationInquiry({ situation: c.situation, goal: c.goal }).mode,
                      query: `${c.situation} ${c.goal}`,
                    }).overallLabel} /></div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/consultant/clients/${assignment.id}/cases/${c.id}`}
                        className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700"
                      >
                        Open full analysis →
                      </Link>
                      <a href={`/api/cases/${c.id}/report`} target="_blank" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Report ↗
                      </a>
                    </div>
                  </CardBody>
                </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Shared documents</h2>
          {scopedDocuments.length === 0 ? (
            <EmptyState title="No documents shared" />
          ) : (
            <Card>
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {scopedDocuments.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <div>
                        <Link href={`/api/files/${d.id}`} target="_blank" className="text-sm font-medium text-lime-600 underline">
                          {d.fileName}
                        </Link>
                        <p className="text-xs text-slate-400">{d.uploadedAt.toLocaleDateString("en-US")}</p>
                      </div>
                      <Badge>{d.docKind}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
