export const IMMIGRATION_ACTION_KEYS = [
  "UPLOAD_DOCUMENTS",
  "UPLOAD_NOTICE",
  "GET_CASE_RECORD",
  "GET_ACCOUNT_RECORD",
  "ADD_DEADLINE",
  "DRAFT_LETTER",
  "COMPLETE_FORM_I485",
  "PREPARE_FORM",
  "REVIEW_ANALYSIS",
  "RERUN_ANALYSIS",
  "PREPARE_APPOINTMENT",
  "ADD_CASE_DETAILS",
] as const;

export type ImmigrationActionKey = (typeof IMMIGRATION_ACTION_KEYS)[number];

export function isImmigrationActionKey(value: string): value is ImmigrationActionKey {
  return (IMMIGRATION_ACTION_KEYS as readonly string[]).includes(value.toUpperCase());
}
