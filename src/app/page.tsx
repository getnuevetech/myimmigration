import Link from "next/link";
import { ArrowRight, FileSearch, ShieldCheck, Users } from "lucide-react";
import Disclaimer from "@/components/Disclaimer";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-orange-700">MyImmigration</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {user.type === "ADMIN" && (
                  <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                    Admin
                  </Link>
                )}
                <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                  Dashboard
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Sign in
              </Link>
            )}
            <Link
              href="/onboarding"
              className="rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white hover:bg-orange-800 transition-colors"
            >
              Start My Case
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
            Tell us your immigration story.
          </h1>
          <p className="mt-4 text-xl text-slate-600 max-w-2xl mx-auto">
            We&apos;ll organize your case, review your documents, identify important issues,
            and explain what your options may be — in plain language.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-700 px-8 py-4 text-lg font-semibold text-white hover:bg-orange-800 transition-colors shadow-lg"
          >
            Start Your Case Review
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            Free to start — no account required
          </p>
        </section>

        {/* Features */}
        <section className="bg-white border-y border-slate-200">
          <div className="mx-auto max-w-5xl px-4 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: FileSearch,
                title: "Document Analysis",
                desc: "Upload I-797s, RFEs, I-485, I-130, and more. We extract key information automatically.",
              },
              {
                icon: ArrowRight,
                title: "Case Timeline",
                desc: "We reconstruct your complete immigration history from documents and your story.",
              },
              {
                icon: ShieldCheck,
                title: "Issue Detection",
                desc: "We flag inconsistencies, missing documents, and upcoming deadlines.",
              },
              {
                icon: Users,
                title: "Attorney Handoff",
                desc: "Export a complete case package so your attorney can start working immediately.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-orange-700" />
                </div>
                <h3 className="font-semibold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What we cover */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">What we can help you with</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Understand my current immigration status",
              "Understand a USCIS letter or notice",
              "See what may be missing from my case",
              "Understand and respond to an RFE",
              "Prepare for an immigration interview",
              "Organize documents for my attorney",
              "Understand why my application was denied",
              "Review my complete immigration history",
              "Understand possible immigration pathways",
              "Prepare questions for an immigration lawyer",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              >
                <span className="text-green-500">✓</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <Disclaimer />
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} MyImmigration — Case Intelligence Platform. Not a law firm. Not legal advice.
      </footer>
    </div>
  );
}
