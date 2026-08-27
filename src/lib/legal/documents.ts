import {
  PRIVACY_POLICY_BODY,
  PRIVACY_POLICY_KIND,
  PRIVACY_POLICY_SLUG,
  PRIVACY_POLICY_TITLE,
} from "./privacy-policy";
import {
  TERMS_OF_SERVICE_BODY,
  TERMS_OF_SERVICE_KIND,
  TERMS_OF_SERVICE_SLUG,
  TERMS_OF_SERVICE_TITLE,
} from "./terms-of-service";
import {
  USER_REGISTRATION_AGREEMENT_BODY,
  USER_REGISTRATION_AGREEMENT_KIND,
  USER_REGISTRATION_AGREEMENT_SLUG,
  USER_REGISTRATION_AGREEMENT_TITLE,
} from "./user-registration-agreement";

export { LEGAL_AGREEMENT_VERSION } from "./consents";
export {
  PRIVACY_POLICY_SLUG,
  PRIVACY_POLICY_TITLE,
} from "./privacy-policy";
export {
  TERMS_OF_SERVICE_SLUG,
  TERMS_OF_SERVICE_TITLE,
} from "./terms-of-service";
export {
  USER_REGISTRATION_AGREEMENT_SLUG,
  USER_REGISTRATION_AGREEMENT_TITLE,
} from "./user-registration-agreement";

export const LEGAL_DRAFT_MARKERS = [
  "DRAFT FOR LEGAL REVIEW",
  "Website-ready legal draft",
  "Before publication, confirm",
  "Before launch, confirm",
  "Important implementation note",
] as const;

export const LEGAL_CONTENT_PAGES = [
  {
    slug: TERMS_OF_SERVICE_SLUG,
    title: TERMS_OF_SERVICE_TITLE,
    kind: TERMS_OF_SERVICE_KIND,
    body: TERMS_OF_SERVICE_BODY,
  },
  {
    slug: PRIVACY_POLICY_SLUG,
    title: PRIVACY_POLICY_TITLE,
    kind: PRIVACY_POLICY_KIND,
    body: PRIVACY_POLICY_BODY,
  },
  {
    slug: USER_REGISTRATION_AGREEMENT_SLUG,
    title: USER_REGISTRATION_AGREEMENT_TITLE,
    kind: USER_REGISTRATION_AGREEMENT_KIND,
    body: USER_REGISTRATION_AGREEMENT_BODY,
  },
] as const;

export const LEGAL_ACCEPTANCE_SLUGS = [
  TERMS_OF_SERVICE_SLUG,
  PRIVACY_POLICY_SLUG,
  USER_REGISTRATION_AGREEMENT_SLUG,
] as const;
