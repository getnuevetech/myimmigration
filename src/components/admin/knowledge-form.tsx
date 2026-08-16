"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveKnowledgeAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Source = {
  id: string;
  title: string;
  sourceType: string;
  reference: string;
  url: string;
  content: string;
  tags: string;
  taxYear: number | null;
  isActive: boolean;
} | null;

export function KnowledgeForm({ source }: { source: Source }) {
  return (
    <ActionForm action={saveKnowledgeAction} successMessage="Source saved.">
      {source && <input type="hidden" name="id" value={source.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title"><input name="title" defaultValue={source?.title} required className={inputClass} /></Field>
        <Field label="Type">
          <select name="sourceType" defaultValue={source?.sourceType ?? "publication"} className={inputClass}>
            <option value="publication">USCIS publication</option>
            <option value="form_instruction">Form instruction</option>
            <option value="notice_guide">Notice guide</option>
            <option value="irm">Policy manual</option>
            <option value="rule">Rule (eligibility, deadlines, evidence…)</option>
            <option value="announcement">Announcement</option>
          </select>
        </Field>
        <Field label="Reference" hint="e.g. I-485, RFE, N-400">
          <input name="reference" defaultValue={source?.reference} className={inputClass} />
        </Field>
        <Field label="Case year (optional)">
          <input name="taxYear" type="number" defaultValue={source?.taxYear ?? ""} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Official URL"><input name="url" defaultValue={source?.url} placeholder="https://www.uscis.gov/…" className={inputClass} /></Field>
        <Field label="Tags" hint="Comma separated: rfe, evidence, deadline, naturalization…">
          <input name="tags" defaultValue={source?.tags} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Content" hint="The text the AI models will be given as authoritative material.">
          <textarea name="content" defaultValue={source?.content} rows={8} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={source?.isActive ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Active
        </label>
        <SubmitButton>{source ? "Save source" : "Add source"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
