"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { CaseGoal, CASE_GOAL_LABELS } from "@/types/case";
import Disclaimer from "@/components/Disclaimer";

const GOALS = Object.entries(CASE_GOAL_LABELS) as [CaseGoal, string][];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [narrative, setNarrative] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<CaseGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleGoal(goal: CaseGoal) {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  }

  async function handleNext() {
    if (step === 1 && narrative.trim().length > 20) {
      setStep(2);
      return;
    }

    if (step === 2 && selectedGoals.length > 0) {
      setSaving(true);
      setError(null);
      sessionStorage.setItem(
        "caseInput",
        JSON.stringify({ narrative, goals: selectedGoals })
      );

      try {
        const res = await fetch("/api/cases/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ narrative, goals: selectedGoals }),
        });
        const payload = await res.json();

        if (res.ok && payload.caseId) {
          sessionStorage.setItem("activeCaseId", payload.caseId);
          router.push(`/upload?caseId=${payload.caseId}`);
          return;
        }
      } catch {
        // fall through to session-backed upload
      }

      setSaving(false);
      setError("We could not save your case yet, but you can still continue.");
      router.push("/upload");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-orange-700">MyImmigration</Link>
          <span className="text-sm text-slate-500">Step {step} of 3</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        {/* Progress */}
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s <= step ? "bg-orange-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Tell us your immigration story
              </h1>
              <p className="mt-2 text-slate-600">
                Write naturally — when you arrived, visas you&apos;ve had, applications filed,
                important life events, and what&apos;s happening now. The more detail, the better.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder={`For example:\n\n"I came to the U.S. on an F-1 visa in 2018 to study at a university in New York. I graduated in 2020 and got OPT. I got married to a U.S. citizen in 2022. We filed I-130 and I-485 in 2023. I received a letter from USCIS last month and I don't understand what it means. We are still together."`}
                className="w-full min-h-64 p-4 text-slate-900 placeholder:text-slate-400 text-sm resize-y focus:outline-none"
              />
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 text-right">
                {narrative.length} characters
              </div>
            </div>

            <Disclaimer compact />
            {error && <p className="text-sm text-amber-700">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                What would you like help with?
              </h1>
              <p className="mt-2 text-slate-600">
                Select all that apply. This helps us focus the analysis on what matters most to you.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              {GOALS.map(([goal, label]) => {
                const selected = selectedGoals.includes(goal);
                return (
                  <button
                    key={goal}
                    onClick={() => toggleGoal(goal)}
                    className={`text-left rounded-xl border px-4 py-3 text-sm transition-all ${
                      selected
                        ? "border-orange-500 bg-orange-50 text-orange-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span className="mr-2">{selected ? "✓" : "○"}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          )}

          <button
            onClick={handleNext}
            disabled={
              saving ||
              (step === 1 && narrative.trim().length <= 20) ||
              (step === 2 && selectedGoals.length === 0)
            }
            className="flex items-center gap-2 rounded-lg bg-orange-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {step === 2 ? (saving ? "Saving..." : "Upload Documents") : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
