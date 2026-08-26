import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge } from "@/components/ui";
import { AdminReanalysisSetup } from "@/components/admin/reanalysis-setup";
import { formatCaseNumber } from "@/lib/case-number";
import Link from "next/link";

export const metadata = { title: "Case re-analysis" };

export default async function AdminReanalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  await guardAdminPage("admin.cases");
  const { caseId } = await searchParams;
  const providers = await db.aiProvider.findMany({ orderBy: { createdAt: "asc" } });
  const preselected = caseId
    ? await db.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          title: true,
          number: true,
          status: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      })
    : null;
  const recent = await db.adminCaseReanalysis.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      case: {
        select: {
          id: true,
          title: true,
          number: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      admin: { select: { email: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Case re-analysis"
        subtitle="Pull any customer's case, re-review it with one or more AI models, compare the new output with what the customer sees, then share or replace that output."
      />
      <AdminReanalysisSetup
        providers={providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          model: provider.model,
          kind: provider.kind,
          supportsVision: provider.supportsVision,
          hasKey: provider.apiKey.length > 0,
          isEnabled: provider.isEnabled,
        }))}
        preselectedCase={
          preselected
            ? {
                id: preselected.id,
                number: formatCaseNumber(preselected.number),
                title: preselected.title,
                status: preselected.status,
                owner: preselected.user
                  ? `${preselected.user.firstName} ${preselected.user.lastName}`.trim() || preselected.user.email
                  : "Guest",
                email: preselected.user?.email ?? "",
              }
            : null
        }
      />

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Recent staff re-reviews</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Visibility</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No staff re-reviews yet.
                  </td>
                </tr>
              )}
              {recent.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/reanalysis/${row.id}`} className="font-medium text-lime-600 underline">
                      {row.case.title.slice(0, 60)}
                    </Link>
                    <p className="font-mono text-xs text-slate-400">{formatCaseNumber(row.case.number)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.case.user
                      ? `${row.case.user.firstName} ${row.case.user.lastName}`.trim() || row.case.user.email
                      : "Guest"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={row.status === "failed" ? "red" : row.status === "overridden" ? "green" : "lime"}>
                      {row.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {row.visibleToCustomer ? "customer" : ""}
                    {row.visibleToCustomer && row.visibleToConsultant ? " · " : ""}
                    {row.visibleToConsultant ? "consultant" : ""}
                    {!row.visibleToCustomer && !row.visibleToConsultant ? "hidden" : ""}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.admin.email}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.createdAt.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
