"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestConsultantMatchAction } from "@/actions/matching";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700 disabled:opacity-60"
    >
      {pending ? "Requesting…" : label}
    </button>
  );
}

export function RequestConsultantMatchForm({
  caseId,
  threadId,
  consultantName,
  agreementHref,
  agreementTitle,
}: {
  caseId?: string;
  threadId?: string;
  consultantName: string;
  agreementHref?: string | null;
  agreementTitle?: string | null;
}) {
  const [state, formAction] = useActionState(requestConsultantMatchAction, null);
  return (
    <form action={formAction} className="mt-4">
      {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}
      {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
      <p className="text-sm text-slate-600">
        Requesting {consultantName} records your consent to the{" "}
        {agreementHref ? (
          <a href={agreementHref} target="_blank" className="font-medium text-lime-600 underline">
            {agreementTitle || "connection agreement"}
          </a>
        ) : (
          "connection agreement"
        )}
        . Nothing is shared until they also accept. This does not auto-assign a professional.
      </p>
      {state?.error && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div className="mt-3">
        <Submit label={`I agree — request ${consultantName}`} />
      </div>
    </form>
  );
}
