import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { hasAdminPermission, requireAdmin } from "@/lib/auth";

const NAV = [
  { area: "admin.dashboard", href: "/admin", label: "Overview" },
  { area: "admin.users", href: "/admin/users", label: "Users" },
  { area: "admin.admins", href: "/admin/admins", label: "Admin users" },
  { area: "admin.ai", href: "/admin/ai-providers", label: "AI providers" },
  { area: "admin.pipelines", href: "/admin/ai-pipelines", label: "AI pipelines" },
  { area: "admin.settings", href: "/admin/platform-settings", label: "Platform settings" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const visibleNav = NAV.filter((item) => hasAdminPermission(user, item.area));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/admin" className="font-bold">
            MyImmigration <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">{user.email}</span>
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
          <nav className="sticky top-6 space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                {item.label}
              </Link>
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
