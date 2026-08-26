"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { clarifyAnswerAction } from "@/actions/case";
import { inputClass } from "./ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl bg-lime-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:opacity-50"
    >
      {pending ? "Updating analysis…" : "Send ↵"}
    </button>
  );
}

export function ClarifyAnswerForm({
  caseId,
  placeholder = "Type your answer… (matching documents, dates, and facts from official material help most. A receipt is not required.)",
  attachHint = "Attach identity, relationship, or other matching evidence — a USCIS notice is optional. Files join this situation and the analysis automatically.",
}: {
  caseId: string;
  placeholder?: string;
  attachHint?: string;
}) {
  const [state, formAction] = useActionState(clarifyAnswerAction, null);
  return (
    <form action={formAction} key={state?.ok ? Date.now() : "form"}>
      <input type="hidden" name="caseId" value={caseId} />
      {state?.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <div className="flex items-start gap-2">
        <textarea
          name="answer"
          rows={2}
          placeholder={placeholder}
          className={`${inputClass} flex-1`}
        />
        <Submit />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.heic,.webp"
          className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-lime-700 file:ring-1 file:ring-lime-200"
        />
        <span className="text-[11px] text-slate-400">{attachHint}</span>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Sending re-runs your analysis with this answer included — findings above update immediately.
      </p>
    </form>
  );
}
