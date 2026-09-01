"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  answerSituationInterviewFormAction,
  type SituationInterviewFormState,
} from "@/actions/situation-interview";
import { inputClass } from "@/components/ui";

type EchoFact = { key: string; label: string; value: string };
type QuestionPayload = {
  candidate: string;
  customer_wording: string;
  reason: string;
  level: 1 | 2;
};

const QUICK_CHOICES: Record<string, string[]> = {
  current_location: ["Inside the United States", "Outside the United States"],
  entry_manner: [
    "With a visa",
    "Processed/released at the border",
    "Entered without being inspected",
    "Another immigration document/status",
    "I'm not sure",
  ],
  government_history: [
    "No",
    "Yes — USCIS application/petition",
    "Yes — immigration court",
    "Yes — Border Patrol/ICE",
    "Yes — visa/consulate",
    "I'm not sure",
  ],
  possible_bases_multiselect: [
    "U.S.-citizen or green-card family member",
    "U.S. employer or job opportunity",
    "Student or school",
    "Afraid or unable to return to my country",
    "Victim of crime, abuse or trafficking",
    "None of these / I'm not sure",
  ],
  return_harm_specificity: [
    "I personally have been threatened or harmed",
    "My family/group has been targeted",
    "Political activity/opinion",
    "Religion/ethnicity/social group",
    "General violence or conflict",
    "Government/police issue",
    "Something else",
  ],
  prior_us_history: ["Yes", "No", "I'm not sure"],
  family_status_clarify: [
    "U.S. citizen",
    "Permanent resident (green card)",
    "Neither / not sure",
  ],
  employer_sponsor_willing: ["Yes", "No", "I'm not sure"],
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl bg-lime-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

/**
 * Phase SI-3 — Situation Intelligence Interview UI.
 * Guests and signed-in users. Iterative cards via Question Director.
 */
export function SituationIntelligenceInterview(props: {
  situationId: string;
  echoFacts: EchoFact[];
  initialQuestion: QuestionPayload | null;
  askedCount: number;
  readyForAnalysis: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>("");
  const [state, formAction, pending] = useActionState(
    answerSituationInterviewFormAction,
    null as SituationInterviewFormState,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      setChoice("");
      startTransition(() => router.refresh());
    }
  }, [state, router]);

  if (props.readyForAnalysis && !props.initialQuestion) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-900">Ready for a clearer analysis</h2>
        <p className="mt-1 text-sm text-slate-600">
          Thanks — we have enough high-value facts to research options that fit what you described, without assuming a path you did not mention.
        </p>
        {props.askedCount > 0 ? (
          <p className="mt-2 text-xs font-medium text-emerald-800">{props.askedCount} detail{props.askedCount === 1 ? "" : "s"} captured</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-emerald-800">Your original story already covered the key orientation facts</p>
        )}
      </section>
    );
  }

  if (!props.initialQuestion) return null;

  const q = props.initialQuestion;
  const chips = QUICK_CHOICES[q.candidate] ?? [];

  return (
    <section className="rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-50/90 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Help us understand your situation</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            A few details that can change which options may apply — not a long intake form.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-lime-600 px-3 py-1 text-xs font-bold text-white">
          {props.askedCount}/6
        </span>
      </div>

      {props.echoFacts.length > 0 ? (
        <div className="mt-4 rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">You already told us</p>
          <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
            {props.echoFacts.map((f) => (
              <li key={f.key}>
                <span className="font-medium text-slate-900">{f.label}:</span> {f.value}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-lime-800">
          {q.level === 1 ? "Orientation" : "About your situation"}
        </p>
        <p className="mt-1 text-base font-medium leading-snug text-slate-900">{q.customer_wording}</p>
        <p className="mt-1 text-sm text-slate-600">{q.reason}</p>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChoice(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                choice === c
                  ? "bg-lime-600 text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : null}

      <form action={formAction} className="mt-4 space-y-2">
        <input type="hidden" name="situationId" value={props.situationId} />
        <input type="hidden" name="candidateId" value={q.candidate} />
        {state?.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
        ) : null}
        <div className="flex items-start gap-2">
          <textarea
            name="answer"
            rows={2}
            required
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            placeholder="Type your answer, or tap a choice above…"
            className={`${inputClass} flex-1`}
          />
          <SubmitButton pending={pending} />
        </div>
      </form>
    </section>
  );
}
