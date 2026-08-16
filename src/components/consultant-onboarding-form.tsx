"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "./action-form";
import { consultantOnboardingAction } from "@/actions/consultant";
import { Field, inputClass } from "./ui";
import { SearchSelect, MultiSearchSelect } from "./search-select";
import { US_STATES } from "@/lib/us-states";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

type Existing = {
  credentialType: string;
  credentialNumber: string;
  licenseState: string;
  ptin: string;
  efin: string;
  isBusiness: boolean;
  businessName: string;
  ein: string;
  statesServed: string;
  yearsExperience: number;
  specialties: string[];
  hasProof: boolean;
  hasPhotoId: boolean;
  hasInsurance: boolean;
  attestedCompliance: boolean;
} | null;

export function ConsultantOnboardingForm({
  existing,
  agreementSlug,
  agreementTitle,
}: {
  existing: Existing;
  agreementSlug: string;
  agreementTitle: string;
}) {
  const initialCredentialType =
    existing?.credentialType === "cpa"
      ? "attorney"
      : existing?.credentialType === "ea"
        ? "accredited_representative"
        : existing?.credentialType === "tax_consultant"
          ? "immigration_consultant"
          : existing?.credentialType ?? "immigration_consultant";
  const [credType, setCredType] = useState(initialCredentialType);
  const [isBusiness, setIsBusiness] = useState(existing?.isBusiness ?? false);
  const needsLicense = ["attorney", "accredited_representative", "cpa", "ea"].includes(credType);
  const isAttorney = credType === "attorney" || credType === "cpa";

  return (
    <ActionForm action={consultantOnboardingAction}>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Professional credential" hint="Attorneys and accredited representatives require a license, accreditation, or registration number and proof.">
          <select name="credentialType" value={credType} onChange={(e) => setCredType(e.target.value)} className={inputClass}>
            <option value="attorney">Immigration attorney</option>
            <option value="accredited_representative">DOJ-accredited representative</option>
            <option value="immigration_consultant">Qualified immigration consultant / preparer</option>
          </select>
        </Field>

        {needsLicense && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={isAttorney ? "Bar license number" : "DOJ accreditation or organization recognition number"}>
              <input name="credentialNumber" defaultValue={existing?.credentialNumber} required className={inputClass} />
            </Field>
            {isAttorney && (
              <Field label="State of licensure" hint="The state bar or licensing jurisdiction that issued your attorney license.">
                <SearchSelect
                  name="licenseState"
                  required
                  defaultValue={existing?.licenseState}
                  placeholder="Search states…"
                  options={US_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}
                />
              </Field>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={needsLicense ? "additional registration number" : "license/registration number (if you have one)"} hint="Use this for state consultant registration, EOIR/USCIS account identifiers, or other professional registration numbers.">
            <input name="ptin" defaultValue={existing?.ptin} placeholder="Registration number" className={inputClass} />
          </Field>
          <Field label="USCIS/EOIR filing-system ID (if any)" hint="Optional account, organization, or representative ID used for online filings.">
            <input name="efin" defaultValue={existing?.efin} placeholder="USCIS or EOIR ID" className={inputClass} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field
            label={needsLicense ? "Credential proof (required)" : "Certification proof"}
            hint={existing?.hasProof ? "On file ✓ — upload to replace" : "Bar card, DOJ accreditation letter, consultant registration, or other credential proof."}
          >
            <input type="file" name="proof" accept=".pdf,image/*" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-50 file:px-3 file:py-1.5 file:text-sm file:text-lime-700" />
          </Field>
          <Field label="Government photo ID" hint={existing?.hasPhotoId ? "On file ✓ — upload to replace" : "Driver's license, passport, or state ID."}>
            <input type="file" name="photoId" accept=".pdf,image/*" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-50 file:px-3 file:py-1.5 file:text-sm file:text-lime-700" />
          </Field>
          <Field label="E&O insurance proof" hint={existing?.hasInsurance ? "On file ✓ — upload to replace" : "Current professional liability coverage."}>
            <input type="file" name="insurance" accept=".pdf,image/*" className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-lime-50 file:px-3 file:py-1.5 file:text-sm file:text-lime-700" />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" name="isBusiness" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-lime-600" />
          I operate as a business (firm/practice) rather than an individual
        </label>
        {isBusiness && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Business name"><input name="businessName" defaultValue={existing?.businessName} className={inputClass} /></Field>
            <Field label="EIN"><input name="ein" defaultValue={existing?.ein} placeholder="00-0000000" className={inputClass} /></Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Years of experience">
            <input name="yearsExperience" type="number" min={0} defaultValue={existing?.yearsExperience ?? 0} className={inputClass} />
          </Field>
          <Field label="States served" hint="Search and add every state you serve.">
            <MultiSearchSelect
              name="statesServed"
              defaultValues={(existing?.statesServed ?? "").split(",").map((s) => s.trim()).filter(Boolean)}
              placeholder="Search states…"
              options={[{ value: "ALL", label: "All states (nationwide)" }, ...US_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))]}
            />
          </Field>
        </div>

        <Field label="Areas of specialty" hint="Used to match you with clients whose situation fits your expertise.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CONSULTANT_SPECIALTIES.map((s) => (
              <label key={s.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-checked:border-lime-400 has-checked:bg-lime-50">
                <input
                  type="checkbox"
                  name="specialties"
                  value={s.key}
                  defaultChecked={existing?.specialties.includes(s.key)}
                  className="h-4 w-4 rounded border-slate-300 text-lime-600"
                />
                {s.name}
              </label>
            ))}
          </div>
        </Field>

        <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <input type="checkbox" name="attestation" defaultChecked={existing?.attestedCompliance} className="mt-1 h-4 w-4 rounded border-slate-300 text-lime-600" />
          <span>
            <span className="font-medium text-slate-800">Compliance attestation.</span> I attest that I am authorized to provide the
            immigration help described in my profile, will follow applicable USCIS/EOIR rules, and have not been convicted of any offense or subjected to
            any sanction that would disqualify me from assisting immigration clients.
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="agree" required className="mt-1 h-4 w-4 rounded border-slate-300 text-lime-600" />
          <span>
            I confirm the information above is accurate and agree to the{" "}
            {agreementSlug ? (
              <Link href={`/p/${agreementSlug}`} target="_blank" className="font-medium text-lime-600 underline">{agreementTitle}</Link>
            ) : (
              agreementTitle
            )}
          </span>
        </label>

        <SubmitButton className="w-full py-3">Submit for review →</SubmitButton>
        <p className="text-center text-xs text-slate-400">
          Applications are reviewed manually by our team. Qualifying immigration professional applications may be approved automatically when enabled.
        </p>
      </div>
    </ActionForm>
  );
}
