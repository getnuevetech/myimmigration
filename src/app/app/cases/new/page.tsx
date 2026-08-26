"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createCaseAction } from "@/actions/case";
import { PageHeader, Field, inputClass } from "@/components/ui";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { resolveIntakeChrome } from "@/lib/goal-intake";

function NewCaseForm() {
  // The guide chatbot hands off new immigration situations here with the user's
  // message pre-filled — the user confirms it as a new review.
  const prefill = useSearchParams().get("prefill") ?? "";
  const intake = resolveIntakeChrome({
    inquiryMode: classifyImmigrationInquiry({ situation: prefill }).mode,
    query: prefill,
  });
  return (
    <div className="max-w-2xl">
      <PageHeader title={intake.pageTitle} subtitle={intake.pageSubtitle} />
      {prefill && (
        <div className="mb-4 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-800">
          {intake.prefillBanner}
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
          <SubmitButton className="w-full py-3">{intake.submitLabel}</SubmitButton>
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
