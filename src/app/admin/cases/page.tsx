import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { loadPresentationsByCaseIds } from "@/lib/case-presentation";
import { caseListSummary } from "@/lib/case-presentation-list";

export const metadata = { title: "Cases" };

export default async function AdminCasesPage() {
  await guardAdminPage("admin.cases");
  const cases = await db.case.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      number: true,
      status: true,
      readinessScore: true,
      actionReadinessScore: true,
      updatedAt: true,
      user: { select: { email: true, firstName: true, lastName: true } },
      issues: { select: { id: true } },
      documents: { where: { deletedAt: null }, select: { id: true } },
      runs: { select: { id: true, stepResults: { select: { id: true }, take: 1 } } },
    },
  });
  const presentations = await loadPresentationsByCaseIds(cases.map((item) => item.id));

  const statusColor = (s: string) =>
    s === "analyzed" ? "green" : s === "consultant_recommended" ? "lime" : s === "analyzing" ? "blue" : "slate";

  return (
    <div>
      <PageHeader
        title="Cases"
        subtitle="Every case on the platform, with the approved posture, next action, and analysis engine."
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Posture</th>
              <th className="px-4 py-3">Next action</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Evidence</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Engine</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3">Docs</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-slate-400">No cases yet.</td></tr>
            )}
            {cases.map((c) => {
              const usedAi = c.runs.some((r) => r.stepResults.length > 0);
              const summary = caseListSummary({
                status: c.status,
                actionReadinessScore: c.actionReadinessScore,
                presentation: presentations.get(c.id) ?? null,
              });
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/admin/cases/${c.id}`} className="font-medium text-lime-600 underline">
                      {c.title.slice(0, 60)}
                    </Link>
                    <p className="font-mono text-xs text-slate-400">{formatCaseNumber(c.number)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : <Badge>guest</Badge>}
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 text-slate-700">{summary.posture}</td>
                  <td className="max-w-[12rem] px-4 py-3 text-slate-700">{summary.nextActionTitle || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {summary.deadlineTitle ? `${summary.deadlineTitle}${summary.deadlineDate ? ` (${summary.deadlineDate})` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{summary.evidenceStrength}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(c.status)}>{c.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge color={usedAi ? "green" : "lime"}>{usedAi ? "AI pipeline" : "rule-based"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.issues.length}</td>
                  <td className="px-4 py-3 text-slate-600">{c.documents.length}</td>
                  <td className="px-4 py-3 text-slate-600">{c.readinessScore}%</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.updatedAt.toLocaleString("en-US")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
