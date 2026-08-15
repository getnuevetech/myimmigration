import { Badge, Card, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Plans & access" };

export default async function AdminPlansPage() {
  await requireAdmin("admin.plans");

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ rank: "asc" }, { monthlyUsd: "asc" }],
    include: {
      features: { include: { feature: true } },
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans & access"
        subtitle="Review subscription plans, feature access, and subscriber counts."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.length === 0 && (
          <Card className="p-6 text-center text-sm text-slate-500">No plans have been created yet.</Card>
        )}
        {plans.map((plan) => (
          <Card key={plan.id}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{plan.description || "No description"}</p>
                </div>
                <Badge color={plan.isActive ? "green" : "slate"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-900">
                ${plan.monthlyUsd}/mo{plan.yearlyUsd ? ` · $${plan.yearlyUsd}/yr` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{plan._count.subscriptions} subscriptions</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {plan.features.map((item) => (
                  <Badge key={item.id} color={item.enabled ? "orange" : "slate"}>
                    {item.feature.label}
                    {item.limitValue ? ` (${item.limitValue})` : ""}
                  </Badge>
                ))}
                {plan.features.length === 0 && <Badge>No features</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
