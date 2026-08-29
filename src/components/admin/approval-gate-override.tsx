"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { overrideApprovalGateAction } from "@/actions/approval-gate";

export function ApprovalGateOverridePanel({
  caseId,
  ruleIds,
  reasons,
}: {
  caseId: string;
  ruleIds: string[];
  reasons: string[];
}) {
  return (
    <div className="mb-6 rounded-xl border border-red-200 bg-red-50/80 p-4">
      <p className="text-sm font-semibold text-red-900">Approval gate BLOCK — customer output withheld</p>
      <p className="mt-1 text-xs text-red-800/90">
        Override is audited (who / when / why). Prefer fixing evidence and re-running analysis when the BLOCK is correct.
      </p>
      {ruleIds.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-xs font-mono text-red-900">
          {ruleIds.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      )}
      {reasons.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-red-900/90">
          {reasons.slice(0, 6).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <ActionForm action={overrideApprovalGateAction} className="mt-3" successMessage="Override recorded.">
        <input type="hidden" name="caseId" value={caseId} />
        <label className="block text-xs font-medium text-red-950">
          Override reason (required, audited)
          <textarea
            name="reason"
            required
            minLength={12}
            rows={3}
            placeholder="Explain why publishing is safe despite these BLOCK rules…"
            className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="mt-2">
          <SubmitButton className="!bg-red-700 hover:!bg-red-800">Override BLOCK and publish</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
