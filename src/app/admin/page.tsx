import Link from "next/link";
import { redirect } from "next/navigation";

const ADMIN_MODULES = [
  {
    key: "ai-providers",
    title: "AI Providers",
    description:
      "Register and manage multi-provider AI credentials, models, and failover priorities.",
  },
  {
    key: "ai-pipelines",
    title: "AI Pipelines",
    description:
      "Configure stage-by-stage orchestration for summary, goal, document, situation, and presentation analysis.",
  },
  {
    key: "plans-features",
    title: "Plans & Feature Access",
    description:
      "Control subscription tiers, feature flags, usage limits, and upgrade checkpoints.",
  },
  {
    key: "payments",
    title: "Payment Gateways",
    description:
      "Manage payment provider integrations and billing behavior from admin-managed settings.",
  },
  {
    key: "content-agreements",
    title: "Content & Agreements",
    description:
      "Maintain terms, privacy, legal pages, and versioned user/consultant/connection agreements.",
  },
  {
    key: "consultants",
    title: "Consultant Operations",
    description:
      "Approve consultants, review assignments, and enforce mutual-consent access workflows.",
  },
  {
    key: "uscis-forms",
    title: "USCIS Form Wizards",
    description:
      "Configure simplified wizard templates and standard USCIS output mappings.",
  },
  {
    key: "platform-settings",
    title: "Platform Settings",
    description:
      "Manage runtime configuration values and environment-like variables without hardcoding.",
  },
];

export default function AdminPage() {
  if (process.env.ADMIN_PREVIEW_ENABLED !== "true") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Admin Control Plane</h1>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Foundation admin shell is in place. Next phases wire RBAC, persistence CRUD, and protected actions.
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_MODULES.map((module) => (
            <section key={module.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">{module.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{module.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                Module scaffolded
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
