import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Cases" };

export default async function AdminCasesPage() {
  await requireAdmin("admin.cases");

  const cases = await prisma.case.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      _count: { select: { documents: true, issues: true, analysisRuns: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cases"
        subtitle="Review submitted immigration cases, ownership, documents, and analysis status."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No cases yet.
                </td>
              </tr>
            )}
            {cases.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.title || "Untitled case"}</p>
                  <p className="max-w-md truncate text-xs text-slate-500">{item.narrative}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {item.user
                    ? `${item.user.firstName ?? ""} ${item.user.lastName ?? ""}`.trim() || item.user.email
                    : "Guest"}
                </td>
                <td className="px-4 py-3">
                  <Badge color={item.status === "COMPLETE" ? "green" : "amber"}>{item.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {item._count.documents} docs · {item._count.issues} issues · {item._count.analysisRuns} runs
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {item.createdAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        Case detail editing is intentionally not exposed yet; use the customer dashboard for user-facing case review.
      </p>
    </div>
  );
}
