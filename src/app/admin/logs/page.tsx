import { Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Audit logs" };

export default async function AdminLogsPage() {
  await requireAdmin("admin.logs");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { email: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        subtitle="Inspect backend audit events and actor metadata."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Metadata</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No audit logs yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.actor?.email ?? "System"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {log.targetType}
                  {log.targetId ? ` · ${log.targetId}` : ""}
                </td>
                <td className="max-w-sm truncate px-4 py-3 text-xs text-slate-500">
                  {log.metadataJson ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {log.createdAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
