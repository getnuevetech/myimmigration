export const IMMIGRATION_DOCUMENT_TYPES = [
  "case_status_record",
  "i797_notice",
  "receipt_notice",
  "rfe",
  "noid",
  "approval_notice",
  "denial_notice",
  "biometrics_notice",
  "interview_notice",
  "uscis_form",
  "identity_document",
  "supporting_evidence",
  "fee_receipt",
  "other",
] as const;

export type ImmigrationDocumentType = (typeof IMMIGRATION_DOCUMENT_TYPES)[number];

const TYPE_HINTS: { type: ImmigrationDocumentType; patterns: RegExp[] }[] = [
  { type: "rfe", patterns: [/\brequest for evidence\b/i, /\bRFE\b/i] },
  { type: "noid", patterns: [/\bnotice of intent to deny\b/i, /\bNOID\b/i] },
  { type: "approval_notice", patterns: [/\bapproval notice\b/i, /\bapproved\b/i] },
  { type: "denial_notice", patterns: [/\bdenial notice\b/i, /\bdenied\b/i] },
  { type: "biometrics_notice", patterns: [/\bbiometrics?\b/i, /\bfingerprint/i] },
  { type: "interview_notice", patterns: [/\binterview\b/i] },
  { type: "i797_notice", patterns: [/\bI-?797C?\b/i, /\bnotice of action\b/i] },
  { type: "receipt_notice", patterns: [/\breceipt notice\b/i, /\breceived your/i] },
  { type: "case_status_record", patterns: [/\bcase status\b/i, /\bmy\.uscis\.gov\b/i] },
  { type: "uscis_form", patterns: [/\bForm\s+(?:I|N|G)-?\d{2,4}[A-Z]?\b/i] },
  { type: "identity_document", patterns: [/\bpassport\b/i, /\bvisa\b/i, /\bA-?Number\b/i] },
  { type: "fee_receipt", patterns: [/\bfiling fee\b/i, /\bfee receipt\b/i, /\bpayment\b/i] },
];

export function classifyImmigrationDocument(input: string): ImmigrationDocumentType {
  for (const hint of TYPE_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(input))) return hint.type;
  }
  return "other";
}
