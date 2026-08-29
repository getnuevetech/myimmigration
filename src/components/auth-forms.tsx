"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ActionForm, SubmitButton } from "./action-form";
import {
  completeGoogleRegisterAction,
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
  startGoogleSignupAction,
} from "@/actions/auth";
import { inputClass } from "./ui";
import {
  CONSULTANT_AGREEMENT_FORM_NAME,
  OPTIONAL_REGISTRATION_CONSENTS,
  REGISTRATION_CONSENTS,
  REQUIRED_CONSENT_BUNDLE_LABEL,
  REQUIRED_REGISTRATION_CONSENT_KEYS,
  emptyConsentGrants,
  requiredConsentsGranted,
  withRequiredConsents,
  type RegistrationConsentGrants,
  type RegistrationConsentKey,
} from "@/lib/legal/consents";

export function LoginForm({ next = "" }: { next?: string }) {
  return (
    <ActionForm action={loginAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div className="space-y-4">
        <input name="email" type="email" required placeholder="Email address" className={inputClass} />
        <input name="password" type="password" required placeholder="Password" className={inputClass} />
        <SubmitButton className="w-full py-2.5">Sign in</SubmitButton>
        <p className="text-center">
          <Link href="/forgot-password" className="text-sm font-medium text-lime-600 hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </ActionForm>
  );
}

export function ForgotPasswordForm() {
  return (
    <ActionForm
      action={requestPasswordResetAction}
      successMessage="If an account exists for that email, a reset link is on its way. It expires in 1 hour."
    >
      <div className="space-y-4">
        <input name="email" type="email" required placeholder="Your email address" className={inputClass} />
        <SubmitButton className="w-full py-2.5">Send reset link</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction}>
      <input type="hidden" name="token" value={token} />
      <div className="space-y-4">
        <input name="password" type="password" required placeholder="New password (8+ characters)" className={inputClass} />
        <input name="confirm" type="password" required placeholder="Repeat new password" className={inputClass} />
        <SubmitButton className="w-full py-2.5">Set new password</SubmitButton>
      </div>
    </ActionForm>
  );
}

export type LegalPageLink = { slug: string; title: string };

function LegalLink({ page, children }: { page: LegalPageLink | null; children: string }) {
  if (!page?.slug) return <>{children}</>;
  return (
    <Link href={`/p/${page.slug}`} target="_blank" className="font-medium text-lime-600 underline">
      {children}
    </Link>
  );
}

function ConsentCheckbox({
  name,
  required,
  checked,
  onChange,
  children,
}: {
  name?: string;
  required: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-600">
      <input
        type="checkbox"
        name={name}
        required={required}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-lime-600"
      />
      <span>
        {required ? null : <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">Optional</span>}
        {children}
      </span>
    </label>
  );
}

function RegistrationConsentFields({
  grants,
  setGrant,
  setRequiredBundle,
  asConsultant,
  consultantAgreement,
  setConsultantAgreement,
  userAgreement,
  terms,
  privacy,
  consultantAgreementPage,
}: {
  grants: RegistrationConsentGrants;
  setGrant: (key: RegistrationConsentKey, value: boolean) => void;
  setRequiredBundle: (value: boolean) => void;
  asConsultant: boolean;
  consultantAgreement: boolean;
  setConsultantAgreement: (value: boolean) => void;
  userAgreement: LegalPageLink | null;
  terms: LegalPageLink | null;
  privacy: LegalPageLink | null;
  consultantAgreementPage: LegalPageLink | null;
}) {
  const requiredChecked = requiredConsentsGranted(grants);

  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Agreements</legend>
      {/* One UI control; each required consent still posts under its own formName for the audit trail. */}
      {REGISTRATION_CONSENTS.filter((item) => item.required).map((item) =>
        grants[item.key] ? <input key={item.key} type="hidden" name={item.formName} value="on" /> : null,
      )}
      <ConsentCheckbox required checked={requiredChecked} onChange={setRequiredBundle}>
        I agree to the ImmigrationOnMe{" "}
        <LegalLink page={userAgreement}>Registration Agreement</LegalLink>,{" "}
        <LegalLink page={terms}>Terms of Service</LegalLink>, and{" "}
        <LegalLink page={privacy}>Privacy Policy</LegalLink>, and I authorize ImmigrationOnMe to process my
        information and documents using AI and approved service providers as described in those policies.
      </ConsentCheckbox>
      <span className="sr-only">{REQUIRED_CONSENT_BUNDLE_LABEL}</span>
      {asConsultant && (
        <ConsentCheckbox
          name={CONSULTANT_AGREEMENT_FORM_NAME}
          required
          checked={consultantAgreement}
          onChange={setConsultantAgreement}
        >
          I have read and agree to the{" "}
          <LegalLink page={consultantAgreementPage}>
            {consultantAgreementPage?.title || "Consultant Partner Agreement"}
          </LegalLink>
          .
        </ConsentCheckbox>
      )}
      {OPTIONAL_REGISTRATION_CONSENTS.map((item) => (
        <ConsentCheckbox
          key={item.key}
          name={item.formName}
          required={false}
          checked={grants[item.key]}
          onChange={(value) => setGrant(item.key, value)}
        >
          {item.label}
        </ConsentCheckbox>
      ))}
    </fieldset>
  );
}

export function RegisterForm({
  asConsultant,
  googleEnabled,
  googlePending,
  pendingProfile,
  userAgreement,
  terms,
  privacy,
  consultantAgreement,
  next = "",
}: {
  asConsultant: boolean;
  googleEnabled: boolean;
  googlePending?: boolean;
  pendingProfile?: { email: string; firstName: string; lastName: string } | null;
  userAgreement: LegalPageLink | null;
  terms: LegalPageLink | null;
  privacy: LegalPageLink | null;
  consultantAgreement: LegalPageLink | null;
  /** Resume path after auth (e.g. /app/qa/{threadId}). */
  next?: string;
}) {
  const [grants, setGrants] = useState<RegistrationConsentGrants>(emptyConsentGrants);
  const [consultantOk, setConsultantOk] = useState(false);
  const requiredReady =
    REQUIRED_REGISTRATION_CONSENT_KEYS.every((key) => grants[key]) && (!asConsultant || consultantOk);

  function setGrant(key: RegistrationConsentKey, value: boolean) {
    setGrants((current) => ({ ...current, [key]: value }));
  }

  function setRequiredBundle(value: boolean) {
    setGrants((current) => withRequiredConsents(current, value));
  }

  const consentFields = (
    <RegistrationConsentFields
      grants={grants}
      setGrant={setGrant}
      setRequiredBundle={setRequiredBundle}
      asConsultant={asConsultant}
      consultantAgreement={consultantOk}
      setConsultantAgreement={setConsultantOk}
      userAgreement={userAgreement}
      terms={terms}
      privacy={privacy}
      consultantAgreementPage={consultantAgreement}
    />
  );

  if (googlePending) {
    return (
      <ActionForm action={completeGoogleRegisterAction}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Google verified {pendingProfile?.email || "your email"}. Accept the required consents to finish creating your account.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              name="firstName"
              required
              defaultValue={pendingProfile?.firstName ?? ""}
              placeholder="First name"
              className={inputClass}
            />
            <input
              name="lastName"
              required
              defaultValue={pendingProfile?.lastName ?? ""}
              placeholder="Last name"
              className={inputClass}
            />
          </div>
          <input
            name="email"
            type="email"
            readOnly
            defaultValue={pendingProfile?.email ?? ""}
            className={`${inputClass} bg-slate-50`}
          />
          {consentFields}
          <p className="text-xs leading-relaxed text-slate-500">
            Checking the required box and creating your account is your electronic signature of the Registration
            Agreement, Terms of Service, and Privacy Policy. ImmigrationOnMe records your name, email, agreement
            version, time, and a consent receipt for each acknowledgment.
          </p>
          <SubmitButton className="w-full py-2.5">Create my account</SubmitButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <div className="space-y-4">
      <ActionForm action={registerAction}>
        {asConsultant && <input type="hidden" name="asConsultant" value="1" />}
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" required placeholder="First name" className={inputClass} />
            <input name="lastName" required placeholder="Last name" className={inputClass} />
          </div>
          <input name="email" type="email" required placeholder="Email address (required)" className={inputClass} />
          <input name="phone" type="tel" placeholder="Mobile number (optional)" className={inputClass} />
          <input name="address" placeholder="Address (optional — you can add it later)" className={inputClass} />
          <input name="password" type="password" required placeholder="Password (8+ characters)" className={inputClass} />
          {consentFields}
          <p className="text-xs leading-relaxed text-slate-500">
            Checking the required box and creating your account is your electronic signature of the Registration
            Agreement, Terms of Service, and Privacy Policy. ImmigrationOnMe records your name, email, agreement
            version, time, and a consent receipt for each acknowledgment.
          </p>
          <SubmitButton className="w-full py-2.5">
            {asConsultant ? "Create consultant account" : "Create my account"}
          </SubmitButton>
        </div>
      </ActionForm>
      {googleEnabled && !asConsultant && (
        <>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
          </div>
          <ActionForm action={startGoogleSignupAction}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            {REGISTRATION_CONSENTS.map((item) =>
              grants[item.key] ? <input key={item.key} type="hidden" name={item.formName} value="on" /> : null,
            )}
            <button
              type="submit"
              disabled={!requiredReady}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue with Google
            </button>
            {!requiredReady && (
              <p className="mt-2 text-center text-xs text-slate-500">
                Check the required agreement above to continue with Google.
              </p>
            )}
          </ActionForm>
        </>
      )}
    </div>
  );
}
