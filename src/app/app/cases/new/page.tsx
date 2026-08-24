"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createCaseAction } from "@/actions/case";
import { PageHeader, Field, inputClass } from "@/components/ui";

function NewCaseForm() {
  // The guide chatbot hands off new immigration situations here with the user's
  // message pre-filled — the user confirms it as a new case.
  const prefill = useSearchParams().get("prefill") ?? "";
  return (
    <div className="max-w-2xl">
      <PageHeader title="Start a new case" subtitle="Tell us what is going on — a USCIS case, a letter, or a situation with no filing yet. We'll map options and next steps." />
      {prefill && (
        <div className="mb-4 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          We carried over what you told the guide — review it, add anything missing, and confirm to open this as a new case.
        </div>
      )}
      <ActionForm action={createCaseAction}>
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="What's going on?" hint="Your own words are perfect. You can describe a USCIS letter, a pending case, or a life situation with no filing yet.">
            <textarea name="situation" rows={6} required defaultValue={prefill} className={inputClass} placeholder="I want to marry a U.S. citizen and get a green card. We have not filed anything yet…" />
          </Field>
          <Field label="What do you want to achieve?" hint="Your goal shapes the options and plan we build.">
            <textarea name="goal" rows={3} className={inputClass} placeholder="Show me what options I have and what I can do next." />
          </Field>
          <SubmitButton className="w-full py-3">Analyze my situation →</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense>
      <NewCaseForm />
    </Suspense>
  );
}
