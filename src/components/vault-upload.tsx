"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { uploadDocumentAction } from "@/actions/documents";
import { inputClass } from "./ui";

export function VaultUpload({
  kinds,
  defaultKind,
  locked = false,
  lockHref = "/app/billing?upgrade=documents",
  lockLabel = "Unlock more uploads with Plus →",
}: {
  kinds: { kind: string; name: string }[];
  defaultKind: string;
  locked?: boolean;
  lockHref?: string;
  lockLabel?: string;
}) {
  if (locked) {
    return (
      <a href={lockHref} className="inline-flex rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
        {lockLabel}
      </a>
    );
  }
  return (
    <ActionForm action={uploadDocumentAction} successMessage="Uploaded to your vault.">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          multiple
          required
          className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-lime-700 hover:file:bg-lime-100"
        />
        <select name="docKind" defaultValue={defaultKind} className={`${inputClass} !w-auto`}>
          {kinds.map((k) => (
            <option key={k.kind} value={k.kind}>{k.name}</option>
          ))}
        </select>
        <SubmitButton>Upload</SubmitButton>
      </div>
    </ActionForm>
  );
}
