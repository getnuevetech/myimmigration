import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { hasAdminPermission, requireAdmin } from "@/lib/auth";

const NAV = [
  { area: "admin.dashboard", href: "/admin", label: "Overview", section: "General" },
  { area: "admin.users", href: "/admin/users", label: "Users", section: "People" },
  { area: "admin.admins", href: "/admin/admins", label: "Admin users", section: "People" },
  { area: "admin.ai", href: "/admin/ai-providers", label: "AI providers", section: "Intelligence" },
  { area: "admin.pipelines", href: "/admin/ai-pipelines", label: "AI pipelines", section: "Intelligence" },
  { area: "admin.settings", href: "/admin/platform-settings", label: "Platform settings", section: "System" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const visibleNav = NAV.filter((item) => hasAdminPermission(user, item.area));
  const sections = Array.from(new Set(visibleNav.map((item) => item.section)));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-xs font-bold">
              M
            </span>
            MyImmigration{" "}
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{user.email}</span>
            <Link href="/" className="text-slate-300 hover:text-white">
              View site
            </Link>
            <form action={logoutAction}>
              <button className="font-medium text-slate-300 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 space-y-5">
            {sections.map((section) => (
              <div key={section}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section}
                </p>
                {visibleNav
                  .filter((item) => item.section === section)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            ))}
            {visibleNav.length === 0 && (
              <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">
                No admin areas assigned.
              </p>
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
