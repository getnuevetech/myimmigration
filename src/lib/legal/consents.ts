export const LEGAL_AGREEMENT_VERSION = "2026-08-26";

export const OAUTH_CONSENTS_COOKIE = "oauth_consents";
export const OAUTH_GOOGLE_PENDING_COOKIE = "oauth_google_pending";

export type RegistrationConsentKey =
  | "agreement_bundle"
  | "core_processing"
  | "ai_processing"
  | "service_providers"
  | "professional_matching"
  | "marketing";

export type RegistrationConsent = {
  key: RegistrationConsentKey;
  formName: string;
  required: boolean;
  label: string;
  error: string;
};

export const REGISTRATION_CONSENTS: readonly RegistrationConsent[] = [
  {
    key: "agreement_bundle",
    formName: "consent_agreement_bundle",
    required: true,
    label:
      "I agree to the ImmigrationOnMe Registration Agreement, Terms of Service, and Privacy Policy.",
    error: "You must agree to the Registration Agreement, Terms of Service, and Privacy Policy.",
  },
  {
    key: "core_processing",
    formName: "consent_core_processing",
    required: true,
    label:
      "I authorize ImmigrationOnMe to securely process and analyze the information and documents I provide to deliver the services I request.",
    error: "You must authorize ImmigrationOnMe to process and analyze the information you provide.",
  },
  {
    key: "ai_processing",
    formName: "consent_ai_processing",
    required: true,
    label:
      "I understand that ImmigrationOnMe uses AI and automated systems to analyze documents and case information, subject to the Agreement and Privacy Policy.",
    error: "You must acknowledge that ImmigrationOnMe uses AI and automated systems.",
  },
  {
    key: "service_providers",
    formName: "consent_service_providers",
    required: true,
    label:
      "I understand approved service providers may process limited information on ImmigrationOnMe’s behalf to operate and secure the service.",
    error: "You must acknowledge that approved service providers may process limited information.",
  },
  {
    key: "professional_matching",
    formName: "consent_professional_matching",
    required: false,
    label:
      "I want ImmigrationOnMe to use my case profile to identify potential authorized immigration professionals when I request professional help.",
    error: "",
  },
  {
    key: "marketing",
    formName: "consent_marketing",
    required: false,
    label: "I agree to receive optional marketing communications.",
    error: "",
  },
];

export const REQUIRED_REGISTRATION_CONSENT_KEYS = REGISTRATION_CONSENTS.filter((item) => item.required).map(
  (item) => item.key,
);

export const CONSULTANT_AGREEMENT_FORM_NAME = "consent_consultant_agreement";

export type RegistrationConsentGrants = Record<RegistrationConsentKey, boolean>;

export type ParseRegistrationConsentsResult =
  | { ok: true; grants: RegistrationConsentGrants; consultantAgreement: boolean }
  | { ok: false; error: string };

export function emptyConsentGrants(): RegistrationConsentGrants {
  return {
    agreement_bundle: false,
    core_processing: false,
    ai_processing: false,
    service_providers: false,
    professional_matching: false,
    marketing: false,
  };
}

export function hasRequiredRegistrationConsents(grants: RegistrationConsentGrants | null | undefined): boolean {
  if (!grants) return false;
  return REQUIRED_REGISTRATION_CONSENT_KEYS.every((key) => grants[key] === true);
}

export function parseRegistrationConsents(
  formData: FormData,
  options?: { asConsultant?: boolean },
): ParseRegistrationConsentsResult {
  const grants = emptyConsentGrants();
  for (const item of REGISTRATION_CONSENTS) {
    grants[item.key] = formData.get(item.formName) === "on";
    if (item.required && !grants[item.key]) {
      return { ok: false, error: item.error };
    }
  }
  const consultantAgreement = formData.get(CONSULTANT_AGREEMENT_FORM_NAME) === "on";
  if (options?.asConsultant && !consultantAgreement) {
    return { ok: false, error: "You must accept the Consultant Partner Agreement to continue." };
  }
  return { ok: true, grants, consultantAgreement };
}

export type OauthConsentsCookie = {
  version: string;
  grants: RegistrationConsentGrants;
  consultantAgreement?: boolean;
};

export function serializeOauthConsentsCookie(value: OauthConsentsCookie): string {
  return JSON.stringify(value);
}

export function parseOauthConsentsCookie(raw: string | undefined | null): OauthConsentsCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OauthConsentsCookie;
    if (!parsed || typeof parsed !== "object" || !parsed.grants) return null;
    const grants = { ...emptyConsentGrants(), ...parsed.grants };
    if (!hasRequiredRegistrationConsents(grants)) return null;
    return {
      version: typeof parsed.version === "string" ? parsed.version : LEGAL_AGREEMENT_VERSION,
      grants,
      consultantAgreement: parsed.consultantAgreement === true,
    };
  } catch {
    return null;
  }
}

export type PendingGoogleProfile = {
  email: string;
  googleId: string;
  firstName: string;
  lastName: string;
};

export function parsePendingGoogleProfile(raw: string | undefined | null): PendingGoogleProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingGoogleProfile;
    if (!parsed?.email || !parsed?.googleId) return null;
    return {
      email: String(parsed.email).toLowerCase(),
      googleId: String(parsed.googleId),
      firstName: String(parsed.firstName ?? ""),
      lastName: String(parsed.lastName ?? ""),
    };
  } catch {
    return null;
  }
}

export const CONSENT_LABELS: Record<RegistrationConsentKey | "consultant_agreement", string> = {
  agreement_bundle: "Registration Agreement, Terms of Service, and Privacy Policy",
  core_processing: "Core data processing",
  ai_processing: "AI and automated processing",
  service_providers: "Operational service providers",
  professional_matching: "Professional matching",
  marketing: "Marketing communications",
  consultant_agreement: "Consultant Partner Agreement",
};
