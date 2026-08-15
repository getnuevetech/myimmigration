import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Assignments" };

export default async function AdminAssignmentsPage() {
  await requireAdmin("admin.assignments");

  const assignments = await prisma.consultantAssignment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      consultant: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const label = (user: { email: string; firstName: string | null; lastName: string | null }) =>
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments"
        subtitle="Track consultant-user assignments and consent workflow status."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Consultant</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No assignments yet.
                </td>
              </tr>
            )}
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{label(assignment.user)}</p>
                  <p className="text-xs text-slate-500">{assignment.user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{label(assignment.consultant)}</p>
                  <p className="text-xs text-slate-500">{assignment.consultant.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge color={assignment.status === "ACTIVE" ? "green" : "amber"}>
                    {assignment.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {assignment.createdAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
