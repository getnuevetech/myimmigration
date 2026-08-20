export const IMMIGRATION_FACT_KEYS = [
  "receipt_number",
  "form_type",
  "notice_type",
  "case_status",
  "filing_date",
  "received_date",
  "notice_date",
  "priority_date",
  "response_deadline",
  "appointment_date",
  "decision_date",
  "requested_evidence",
  "applicant_name",
  "petitioner_name",
  "beneficiary_name",
  "a_number",
  "agency_address",
  "filing_location",
  "fee_issue",
] as const;

export type ImmigrationFactKey = (typeof IMMIGRATION_FACT_KEYS)[number];

export function isImmigrationFactKey(value: string): value is ImmigrationFactKey {
  return (IMMIGRATION_FACT_KEYS as readonly string[]).includes(value);
}
