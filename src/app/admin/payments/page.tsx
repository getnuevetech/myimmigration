import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Payment gateways" };

export default async function AdminPaymentsPage() {
  await requireAdmin("admin.payments");

  const gateways = await prisma.paymentGatewayConfig.findMany({
    orderBy: { providerKey: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment gateways"
        subtitle="Review payment gateway records and enabled state."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Provider key</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gateways.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  No payment gateways configured yet.
                </td>
              </tr>
            )}
            {gateways.map((gateway) => (
              <tr key={gateway.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{gateway.label}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{gateway.providerKey}</td>
                <td className="px-4 py-3">
                  <Badge color={gateway.enabled ? "green" : "slate"}>
                    {gateway.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {gateway.updatedAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
