"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createAdminUserAction,
  updateAdminPermissionsAction,
} from "@/actions/admin-users";
import { ADMIN_AREAS, type AdminAreaKey } from "@/lib/admin-areas";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none";
const buttonClass =
  "rounded-lg bg-orange-700 px-4 py-2 text-sm font-medium text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Saving..." : children}
    </button>
  );
}

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
}

function AreaCheckboxes({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ADMIN_AREAS.map((area) => (
        <label
          key={area.key}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <input
            name="areas"
            type="checkbox"
            value={area.key}
            defaultChecked={selected.includes(area.key)}
            className="h-4 w-4 rounded border-slate-300 text-orange-600"
          />
          {area.label}
        </label>
      ))}
    </div>
  );
}

export function CreateAdminUserForm() {
  const [state, action] = useActionState(createAdminUserAction, {});

  return (
    <form action={action} className="space-y-4">
      <ErrorMessage error={state.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className={inputClass} />
        <input name="lastName" placeholder="Last name" className={inputClass} />
      </div>
      <input name="email" type="email" required placeholder="Admin email" className={inputClass} />
      <input name="password" type="password" required placeholder="Temporary password" className={inputClass} />
      <AreaCheckboxes selected={ADMIN_AREAS.map((area) => area.key)} />
      <SubmitButton>Create admin</SubmitButton>
    </form>
  );
}

export function AdminPermissionsForm({
  userId,
  selected,
}: {
  userId: string;
  selected: AdminAreaKey[];
}) {
  const [state, action] = useActionState(updateAdminPermissionsAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <ErrorMessage error={state.error} />
      <AreaCheckboxes selected={selected} />
      <SubmitButton>Update permissions</SubmitButton>
    </form>
  );
}
