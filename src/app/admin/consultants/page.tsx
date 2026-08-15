import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Consultants" };

export default async function AdminConsultantsPage() {
  await requireAdmin("admin.consultants");

  const consultants = await prisma.consultantProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultants"
        subtitle="Review consultant profiles, approval status, specialties, and account ownership."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Consultant</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Specialties</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {consultants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No consultant profiles yet.
                </td>
              </tr>
            )}
            {consultants.map((consultant) => (
              <tr key={consultant.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{consultant.displayName}</p>
                  <p className="text-xs text-slate-500">{consultant.user.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{consultant.consultantType}</td>
                <td className="max-w-sm px-4 py-3 text-xs text-slate-500">
                  {consultant.specialtiesJson || "Not provided"}
                </td>
                <td className="px-4 py-3">
                  <Badge color={consultant.approved ? "green" : "amber"}>
                    {consultant.approved ? "Approved" : "Pending"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={consultant.user.status === "ACTIVE" ? "green" : "amber"}>
                    {consultant.user.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
