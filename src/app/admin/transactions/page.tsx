import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Transactions" };

export default async function AdminTransactionsPage() {
  await requireAdmin("admin.transactions");

  const transactions = await prisma.paymentTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      subscription: {
        include: {
          user: { select: { email: true } },
          plan: { select: { name: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="Review payment transaction history and gateway references."
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Gateway ref</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No transactions yet.
                </td>
              </tr>
            )}
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td className="px-4 py-3 text-xs text-slate-500">{transaction.subscription.user.email}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{transaction.subscription.plan.name}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {(transaction.amountCents / 100).toLocaleString("en-US", {
                    style: "currency",
                    currency: transaction.currency,
                  })}
                </td>
                <td className="px-4 py-3">
                  <Badge color={transaction.status === "SUCCEEDED" ? "green" : "amber"}>
                    {transaction.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{transaction.gatewayRef ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {transaction.createdAt.toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
