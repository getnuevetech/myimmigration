import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Stat } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { runEvidenceBackfillAction } from "@/actions/admin";

export const metadata = { title: "Evidence diagnostics" };

const STATUS_COLOR: Record<string, string> = {
  extracted: "green",
  needs_review: "lime",
  failed: "red",
  uploaded: "slate",
  extracting: "blue",
};

export default async function AdminEvidencePage() {
  await guardAdminPage("admin.evidence");

  const [
    totalDocuments,
    extractedDocuments,
    needsReviewDocuments,
    failedDocuments,
    staleDocuments,
    failedOrReviewDocs,
    recentAudits,
  ] = await Promise.all([
    db.document.count({ where: { deletedAt: null, docKind: { not: "avatar" } } }),
    db.document.count({ where: { deletedAt: null, processingStatus: "extracted" } }),
    db.document.count({ where: { deletedAt: null, processingStatus: "needs_review" } }),
    db.document.count({ where: { deletedAt: null, processingStatus: "failed" } }),
    db.document.count({
      where: {
        deletedAt: null,
        docKind: { not: "avatar" },
        OR: [{ extractionSchemaVersion: "" }, { processingStatus: { in: ["uploaded", "failed"] } }],
      },
    }),
    db.document.findMany({
      where: { deletedAt: null, processingStatus: { in: ["needs_review", "failed"] }, caseId: { not: null } },
      orderBy: { uploadedAt: "desc" },
      take: 50,
      include: { case: { select: { id: true, number: true, title: true } }, user: { select: { email: true } } },
    }),
    db.evidenceAudit.findMany({
      where: { status: { in: ["needs_more_evidence", "needs_review", "blocked"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { case: { select: { id: true, number: true, title: true, user: { select: { email: true } } } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Evidence diagnostics"
        subtitle="Operational view of document processing, evidence audits, and cases that need review or backfill."
        actions={
          <form action={runEvidenceBackfillAction} className="flex items-center gap-2">
            <input type="hidden" name="limit" value="25" />
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Run evidence backfill
            </button>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Documents" value={totalDocuments} />
        <Stat label="Extracted" value={extractedDocuments} />
        <Stat label="Needs review" value={needsReviewDocuments} />
        <Stat label="Failed" value={failedDocuments} />
        <Stat label="Backfill queue" value={staleDocuments} sub="processed from /api/health" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Documents needing attention</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Case</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {failedOrReviewDocs.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No failed or review-needed documents.</td></tr>
                )}
                {failedOrReviewDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="max-w-xs truncate font-medium text-slate-800">{doc.fileName}</p>
                      <p className="text-xs text-slate-400">{doc.documentType || doc.docKind} · {doc.uploadedAt.toLocaleString("en-US")}</p>
                      {doc.user?.email && <p className="text-xs text-slate-400">{doc.user.email}</p>}
                    </td>
                    <td className="px-4 py-3"><Badge color={STATUS_COLOR[doc.processingStatus] ?? "slate"}>{doc.processingStatus.replace(/_/g, " ")}</Badge></td>
                    <td className="px-4 py-3">
                      {doc.case ? (
                        <Link href={`/admin/cases/${doc.case.id}`} className="font-medium text-lime-600 underline">
                          {formatCaseNumber(doc.case.number)}
                        </Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent evidence audits needing review</h2>
          <div className="space-y-2">
            {recentAudits.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                No review-needed evidence audits.
              </p>
            )}
            {recentAudits.map((audit) => (
              <div key={audit.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={audit.status === "blocked" ? "red" : audit.status === "needs_review" ? "lime" : "slate"}>
                    {audit.status.replace(/_/g, " ")}
                  </Badge>
                  {audit.case && (
                    <Link href={`/admin/cases/${audit.case.id}`} className="font-medium text-lime-600 underline">
                      {formatCaseNumber(audit.case.number)}
                    </Link>
                  )}
                  <span className="text-xs text-slate-400">{audit.createdAt.toLocaleString("en-US")}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{audit.summary || "No summary recorded."}</p>
                {audit.case?.user?.email && <p className="mt-1 text-xs text-slate-400">{audit.case.user.email}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
