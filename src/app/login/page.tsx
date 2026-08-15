import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.type === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-orange-700">
            MyImmigration
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            Back
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-center text-3xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Sign in to continue your immigration case.
        </p>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </section>
      </main>
    </div>
  );
}
