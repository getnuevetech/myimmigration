"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  bootstrapAdminAction,
  loginAction,
  registerAction,
  type AuthActionState,
} from "@/actions/auth";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none";
const buttonClass =
  "w-full rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Please wait..." : children}
    </button>
  );
}

function FormError({ state }: { state: AuthActionState }) {
  if (!state?.error) return null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <input name="email" type="email" required placeholder="Email address" className={inputClass} />
      <input name="password" type="password" required placeholder="Password" className={inputClass} />
      <SubmitButton>Sign in</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-orange-700 underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});

  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className={inputClass} />
        <input name="lastName" placeholder="Last name" className={inputClass} />
      </div>
      <input name="email" type="email" required placeholder="Email address" className={inputClass} />
      <input name="password" type="password" required placeholder="Password (8+ characters)" className={inputClass} />
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <input name="acceptedTerms" type="checkbox" required className="mt-0.5" />
        <span>
          I agree to the current MyImmigration terms and understand this platform provides
          informational guidance only, not legal advice.
        </span>
      </label>
      <SubmitButton>Create account</SubmitButton>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-orange-700 underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function BootstrapAdminForm() {
  const [state, action] = useActionState(bootstrapAdminAction, {});

  return (
    <form action={action} className="space-y-4">
      <FormError state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className={inputClass} />
        <input name="lastName" placeholder="Last name" className={inputClass} />
      </div>
      <input name="email" type="email" required placeholder="Admin email" className={inputClass} />
      <input name="password" type="password" required placeholder="Password (8+ characters)" className={inputClass} />
      <SubmitButton>Create first admin</SubmitButton>
    </form>
  );
}
