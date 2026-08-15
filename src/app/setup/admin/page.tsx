import Link from "next/link";
import { redirect } from "next/navigation";
import { BootstrapAdminForm } from "@/components/auth-forms";
import { prisma } from "@/lib/db/prisma";

export const metadata = { title: "Create first admin" };
export const dynamic = "force-dynamic";

export default async function AdminBootstrapPage() {
  const adminCount = await prisma.user.count({ where: { type: "ADMIN" } });
  if (adminCount > 0) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-orange-700">
            MyImmigration
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-center text-3xl font-bold text-slate-900">Create first admin</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          This one-time setup creates the initial administrator for the backend.
        </p>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <BootstrapAdminForm />
        </section>
      </main>
    </div>
  );
}
