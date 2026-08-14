"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function ContinuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [caseId, setCaseId] = useState<string | null>(searchParams.get("caseId"));

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("caseId")) {
      setCaseId(searchParams.get("caseId"));
      return;
    }

    if (typeof window !== "undefined") {
      setCaseId(sessionStorage.getItem("activeCaseId"));
    }
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/guest/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, acceptedTerms }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "We could not continue your case.");
        setSubmitting(false);
        return;
      }

      if (caseId) {
        router.push(`/dashboard?caseId=${caseId}`);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("We could not continue your case.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-blue-700">
            MyImmigration
          </Link>
          <Link href="/pricing" className="text-sm text-blue-700 hover:underline">
            View plans
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Save your case
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Create your account to unlock full results
          </h1>
          <p className="mt-3 text-slate-600">
            We&apos;ll attach your guest case, documents, and analysis history to your account so
            you can continue later.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700">
                First name
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Last name
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to continue under the current MyImmigration terms and understand this
                platform provides informational guidance only, not legal advice.
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !acceptedTerms}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving your account..." : "Continue with email"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
