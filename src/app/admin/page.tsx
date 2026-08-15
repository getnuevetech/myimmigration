import Link from "next/link";
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
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
        Admin backend is protected by user sessions and role permissions.
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <section key={module.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{module.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{module.description}</p>
            <Link
              href={module.href}
              className="mt-3 inline-flex text-xs font-medium uppercase tracking-wide text-orange-600 hover:text-orange-700"
            >
              Open module
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
