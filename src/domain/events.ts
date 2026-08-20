export const IMMIGRATION_EVENT_TYPES = [
  "case_filed",
  "case_received",
  "receipt_issued",
  "notice_issued",
  "rfe_issued",
  "noid_issued",
  "biometrics_scheduled",
  "interview_scheduled",
  "response_due",
  "case_approved",
  "case_denied",
  "case_status_updated",
] as const;

export type ImmigrationEventType = (typeof IMMIGRATION_EVENT_TYPES)[number];
