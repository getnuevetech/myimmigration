import Link from "next/link";
import { Card, CardBody, PageHeader } from "@/components/admin-ui";
import { hasAdminPermission, requireAdmin } from "@/lib/auth";
import type { AdminAreaKey } from "@/lib/admin-areas";

type AdminModule = {
  key: AdminAreaKey;
  title: string;
  description: string;
  href: string;
};

const ADMIN_MODULES: AdminModule[] = [
  {
    key: "admin.cases",
    title: "Cases",
    description: "Review submitted case narratives, analysis status, documents, and issue counts.",
    href: "/admin/cases",
  },
  {
    key: "admin.users",
    title: "Users",
    description: "Review users, account status, subscriptions, and case activity.",
    href: "/admin/users",
  },
  {
    key: "admin.admins",
    title: "Admin Users",
    description: "Create admins and assign backend permissions.",
    href: "/admin/admins",
  },
  {
    key: "admin.consultants",
    title: "Consultants",
    description: "Review consultant profiles, approvals, specialties, and account ownership.",
    href: "/admin/consultants",
  },
  {
    key: "admin.assignments",
    title: "Assignments",
    description: "Track consultant-user assignments and consent status.",
    href: "/admin/assignments",
  },
  {
    key: "admin.ai",
    title: "AI Providers",
    description:
      "Register and manage multi-provider AI credentials, models, and failover priorities.",
    href: "/admin/ai-providers",
  },
  {
    key: "admin.pipelines",
    title: "AI Pipelines",
    description:
      "Configure stage-by-stage orchestration for summary, goal, document, situation, and presentation analysis.",
    href: "/admin/ai-pipelines",
  },
  {
    key: "admin.plans",
    title: "Plans & Access",
    description: "Manage subscription plans, feature access, and plan availability.",
    href: "/admin/plans",
  },
  {
    key: "admin.payments",
    title: "Payment Gateways",
    description: "Review configured payment gateway records and gateway state.",
    href: "/admin/payments",
  },
  {
    key: "admin.transactions",
    title: "Transactions",
    description: "Review payment transaction history and statuses.",
    href: "/admin/transactions",
  },
  {
    key: "admin.content",
    title: "Content & Agreements",
    description: "Review content pages and agreement versions.",
    href: "/admin/content",
  },
  {
    key: "admin.forms",
    title: "USCIS Forms",
    description: "Review USCIS form templates and generated submissions.",
    href: "/admin/forms",
  },
  {
    key: "admin.notifications",
    title: "Notifications",
    description: "Inspect system and user notification records.",
    href: "/admin/notifications",
  },
  {
    key: "admin.logs",
    title: "Audit Logs",
    description: "Inspect audit events written by backend operations.",
    href: "/admin/logs",
  },
  {
    key: "admin.settings",
    title: "Platform Settings",
    description:
      "Manage runtime configuration values and environment-like variables without hardcoding.",
    href: "/admin/platform-settings",
  },
];

export default async function AdminPage() {
  const user = await requireAdmin();
  const modules = ADMIN_MODULES.filter((module) => hasAdminPermission(user, module.key));

  return (
    <div>
      <PageHeader
        title="Admin overview"
        subtitle="Manage users, administrators, AI providers, pipeline behavior, and platform settings."
      />
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
        Admin backend is protected by user sessions and role permissions.
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.key}>
            <CardBody>
              <h2 className="text-sm font-semibold text-slate-900">{module.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{module.description}</p>
              <Link
                href={module.href}
                className="mt-3 inline-flex text-xs font-medium uppercase tracking-wide text-orange-600 hover:text-orange-700"
              >
                Open module
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
