"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { uploadNoticeAction } from "@/actions/documents";
import { SubmitButton } from "./action-form";
import { inputClass } from "./ui";

export function NoticeUpload({
  cases = [],
  defaultCaseId = "",
  locked = false,
  lockHref = "/app/billing?upgrade=notices",
  lockLabel = "Unlock notice explanations with Plus →",
}: {
  cases?: { id: string; label: string }[];
  defaultCaseId?: string;
  locked?: boolean;
  lockHref?: string;
  lockLabel?: string;
}) {
  const [state, formAction] = useActionState(uploadNoticeAction, null);
  const [caseId, setCaseId] = useState(defaultCaseId);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setCaseId(defaultCaseId);
      router.refresh();
    }
  }, [defaultCaseId, state, router]);

  if (locked) {
    return (
      <a href={lockHref} className="inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
        {lockLabel}
      </a>
    );
  }

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Notice received — see its explanation below.</p>}
      {cases.length > 0 && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Related case (optional)</span>
          <select name="caseId" value={caseId} onChange={(e) => setCaseId(e.target.value)} className={inputClass}>
            <option value="">Not linked to a case</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-lime-400">
          <span className="text-sm font-medium text-slate-700">Upload or photograph the notice</span>
          <span className="mt-1 text-xs text-slate-400">PDF or photo — use your phone camera if you like</span>
          <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,image/*,application/pdf" capture="environment" className="mt-2 text-xs" />
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">…or paste the text of the letter</p>
          <textarea name="pastedText" rows={4} className={inputClass} placeholder="Paste what the letter says, including the form, notice type, receipt number, or deadline if you see one…" />
        </div>
      </div>
      <SubmitButton>Explain this notice →</SubmitButton>
    </form>
  );
}
