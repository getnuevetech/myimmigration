import Link from "next/link";
import { getPublicPlans } from "@/lib/subscriptions";

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">MyImmigration Plans</p>
            <h1 className="text-2xl font-bold text-slate-900">Choose how far you want to go</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <section
              key={plan.key}
              className={`rounded-2xl border bg-white p-6 shadow-sm ${
                plan.recommended ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
                  <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                </div>
                {plan.recommended && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Recommended
                  </span>
                )}
              </div>

              <div className="mt-6">
                <p className="text-3xl font-bold text-slate-900">
                  ${plan.monthlyUsd}
                  <span className="text-sm font-medium text-slate-500">/mo</span>
                </p>
                {plan.yearlyUsd ? (
                  <p className="mt-1 text-sm text-slate-500">${plan.yearlyUsd}/year</p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">No payment required</p>
                )}
              </div>

              <ul className="mt-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-green-500">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                Payment checkout wiring is the next phase; plan and feature gating foundations are now in place.
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
