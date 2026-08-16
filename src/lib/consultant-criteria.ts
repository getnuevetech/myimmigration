import "server-only";
import { getSetting, getNumberSetting, getBoolSetting } from "./settings";

// Automated-approval criteria for Immigration Consultant applications, based on
// what the USCIS requires or expects of paid immigration professionals. The admin
// chooses which of these are REQUIRED for automated approval; applications
// meeting every required criterion are approved without manual review.

export type CriterionDef = {
  key: string;
  name: string;
  description: string;
  hasValue?: boolean; // criterion with a configurable threshold (e.g. minimum years)
};

export const APPROVAL_CRITERIA: CriterionDef[] = [
  {
    key: "credential",
    name: "Verified immigration professional credential",
    description:
      "Applicant is an immigration attorney, DOJ-accredited representative, or otherwise registered immigration professional with a credential number and supporting proof.",
  },
  {
    key: "ptin",
    name: "license/registration number provided",
    description:
      "Applicant provided a relevant bar, DOJ, state consultant, USCIS, EOIR, or other professional registration number.",
  },
  {
    key: "proof",
    name: "Credential document uploaded",
    description: "A copy of the attorney license, DOJ accreditation letter, consultant registration, or other credential proof is attached to the application.",
  },
  {
    key: "photo_id",
    name: "Government-issued photo ID uploaded",
    description: "Identity verification document (driver's license, passport, or state ID), consistent with USCIS e-Services identity-proofing practice.",
  },
  {
    key: "insurance",
    name: "Professional liability (E&O) insurance proof uploaded",
    description: "Evidence of current errors-and-omissions coverage — standard practice for professionals handling client immigration matters.",
  },
  {
    key: "efin",
    name: "USCIS/EOIR filing-system ID provided",
    description:
      "Optional USCIS, EOIR, organization, or representative account identifier used by professionals who file or manage matters online.",
  },
  {
    key: "ein",
    name: "Business EIN provided (business accounts)",
    description: "Firms/practices must supply their Employer Identification Number. Automatically satisfied for individual (non-business) applicants.",
  },
  {
    key: "states",
    name: "States served declared",
    description: "The applicant listed the states in which they serve clients.",
  },
  {
    key: "min_years",
    name: "Minimum years of experience",
    description: "Years of professional immigration experience meets or exceeds the configured minimum.",
    hasValue: true,
  },
  {
    key: "attestation",
    name: "Compliance attestation accepted",
    description:
      "Applicant attests they are authorized to provide the immigration help described, will follow applicable USCIS/EOIR rules, and have no disqualifying sanctions or convictions.",
  },
];

export type ApplicationFacts = {
  credentialType: string;
  credentialNumber: string;
  licenseState: string;
  ptin: string;
  efin: string;
  proofDocumentPath: string;
  photoIdPath: string;
  insurancePath: string;
  isBusiness: boolean;
  ein: string;
  statesServed: string;
  yearsExperience: number;
  attestedCompliance: boolean;
};

export function criterionSatisfied(key: string, f: ApplicationFacts, minYears: number): boolean {
  switch (key) {
    case "credential":
      return ["attorney", "accredited_representative", "cpa", "ea"].includes(f.credentialType) && !!f.credentialNumber && (!["attorney", "cpa"].includes(f.credentialType) || !!f.licenseState);
    case "ptin":
      return f.ptin.trim().length > 0;
    case "proof":
      return !!f.proofDocumentPath;
    case "photo_id":
      return !!f.photoIdPath;
    case "insurance":
      return !!f.insurancePath;
    case "efin":
      return f.efin.trim().length > 0;
    case "ein":
      return !f.isBusiness || !!f.ein.trim();
    case "states":
      return f.statesServed.trim().length > 0;
    case "min_years":
      return f.yearsExperience >= minYears;
    case "attestation":
      return f.attestedCompliance;
    default:
      return false;
  }
}

export async function getRequiredCriteria(): Promise<string[]> {
  const raw = await getSetting("consultants.auto_criteria", '["credential","ptin","proof","min_years","attestation"]');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// Evaluates an application against the admin-required criteria.
// Returns qualification plus the per-criterion breakdown (for admin review).
export async function evaluateAutoApproval(f: ApplicationFacts): Promise<{
  enabled: boolean;
  qualifies: boolean;
  results: { key: string; name: string; required: boolean; satisfied: boolean }[];
}> {
  const [enabled, required, minYears] = await Promise.all([
    getBoolSetting("consultants.auto_approve_enabled", false),
    getRequiredCriteria(),
    getNumberSetting("consultants.auto_approve_min_years", 3),
  ]);
  const results = APPROVAL_CRITERIA.map((c) => ({
    key: c.key,
    name: c.name,
    required: required.includes(c.key),
    satisfied: criterionSatisfied(c.key, f, minYears),
  }));
  const qualifies = enabled && required.length > 0 && results.every((r) => !r.required || r.satisfied);
  return { enabled, qualifies, results };
}
