export const IMMIGRATION_DOCUMENT_TYPES = [
  "uscis_vawa_prima_facie_notice",
  "uscis_i360_receipt_notice",
  "aos_filing_record",
  "rfe",
  "noid",
  "approval_notice",
  "denial_notice",
  "biometrics_notice",
  "interview_notice",
  "i797_notice",
  "receipt_notice",
  "case_status_record",
  "admission_entry_record",
  "relationship_civil_document",
  "personal_declaration",
  "uscis_form",
  "identity_document",
  "supporting_evidence",
  "fee_receipt",
  "other",
] as const;

export type ImmigrationDocumentType = (typeof IMMIGRATION_DOCUMENT_TYPES)[number];

type TypeHint = {
  type: ImmigrationDocumentType;
  patterns: RegExp[];
};

const TYPE_HINTS: TypeHint[] = [
  { type: "rfe", patterns: [/\brequest for evidence\b/i, /\bRFE\b/i] },
  { type: "noid", patterns: [/\bnotice of intent to deny\b/i, /\bNOID\b/i] },
  { type: "uscis_vawa_prima_facie_notice", patterns: [/\bprima facie\b/i] },
  {
    type: "uscis_i360_receipt_notice",
    patterns: [
      /\bi-?360[-_\s]?receipt\b/i,
      /\breceipt[-_\s]?notice[-_\s]?i-?360\b/i,
      /\bi-?360[-_\s]?notice\b/i,
      /\bform\s*i-?360\b[\s\S]{0,400}\b(?:receipt|received your|we received)\b/i,
      /\breceipt notice\b[\s\S]{0,800}\bi-?360\b/i,
      /\bi-?360\b[\s\S]{0,800}\b(?:receipt notice|received your|we received your)\b/i,
      /\b(?:receipt notice|received your|we received your)\b[\s\S]{0,800}\bi-?360\b/i,
    ],
  },
  {
    type: "aos_filing_record",
    patterns: [
      /\bi-?485[-_\s]?receipt\b/i,
      /\breceipt notice\b[\s\S]{0,800}\bi-?485\b/i,
      /\bi-?485\b[\s\S]{0,800}\b(?:receipt notice|received your|we received your)\b/i,
      /\b(?:receipt notice|received your|we received your)\b[\s\S]{0,800}\bi-?485\b/i,
    ],
  },
  { type: "approval_notice", patterns: [/\bapproval notice\b/i, /\bapproved\b/i] },
  { type: "denial_notice", patterns: [/\bdenial notice\b/i, /\bdenied\b/i] },
  { type: "biometrics_notice", patterns: [/\bbiometrics?\b/i, /\bfingerprint/i] },
  { type: "interview_notice", patterns: [/\binterview\b/i] },
  { type: "i797_notice", patterns: [/\bI-?797C?\b/i, /\bnotice of action\b/i] },
  { type: "receipt_notice", patterns: [/\breceipt notice\b/i, /\breceived your/i] },
  { type: "case_status_record", patterns: [/\bcase status\b/i, /\bmy\.uscis\.gov\b/i] },
  { type: "admission_entry_record", patterns: [/\bI-?94\b/, /\barrival\/departure\b/i, /\badmission(?:\/entry)? record\b/i] },
  { type: "relationship_civil_document", patterns: [/\bmarriage[-_\s]?certificate\b/i, /\bcertificate of marriage\b/i, /\bcivil (?:marriage )?document\b/i] },
  { type: "personal_declaration", patterns: [/\bpersonal[-_\s]?declaration\b/i, /\bpersonal statement\b/i, /\bsworn statement\b/i, /\bmy declaration\b/i] },
  { type: "uscis_form", patterns: [/\bForm\s+(?:I|N|G)-?\d{2,4}[A-Z]?\b/i] },
  { type: "identity_document", patterns: [/\bpassport\b/i, /\bvisa (?:foil|stamp|page)\b/i, /\bnonimmigrant visa\b/i, /\bimmigrant visa\b/i, /\bbiographic page\b/i, /\bnational id\b/i] },
  { type: "fee_receipt", patterns: [/\bfiling fee\b/i, /\bfee receipt\b/i, /\bpayment\b/i] },
];

const TYPE_LABELS: Record<ImmigrationDocumentType, string> = {
  uscis_vawa_prima_facie_notice: "USCIS VAWA Prima Facie Notice",
  uscis_i360_receipt_notice: "USCIS I-360 Receipt Notice",
  aos_filing_record: "Adjustment of Status Filing Record",
  rfe: "USCIS Request for Evidence",
  noid: "USCIS Notice of Intent to Deny",
  approval_notice: "USCIS Approval Notice",
  denial_notice: "USCIS Denial Notice",
  biometrics_notice: "USCIS Biometrics Notice",
  interview_notice: "USCIS Interview Notice",
  i797_notice: "USCIS Notice of Action",
  receipt_notice: "USCIS Receipt Notice",
  case_status_record: "USCIS Case Status Record",
  admission_entry_record: "Admission / Entry Record",
  relationship_civil_document: "Relationship / Civil Document",
  personal_declaration: "Personal Declaration",
  uscis_form: "USCIS Form",
  identity_document: "Identity & Entry Document",
  supporting_evidence: "Supporting Evidence",
  fee_receipt: "Fee Receipt",
  other: "Other",
};

const CATALOG_KIND_BY_TYPE: Record<ImmigrationDocumentType, string> = {
  uscis_vawa_prima_facie_notice: "notice",
  uscis_i360_receipt_notice: "receipt",
  aos_filing_record: "receipt",
  rfe: "rfe",
  noid: "notice",
  approval_notice: "approval",
  denial_notice: "notice",
  biometrics_notice: "notice",
  interview_notice: "notice",
  i797_notice: "notice",
  receipt_notice: "receipt",
  case_status_record: "case_record",
  admission_entry_record: "identity",
  relationship_civil_document: "relationship",
  personal_declaration: "declaration",
  uscis_form: "form",
  identity_document: "identity",
  supporting_evidence: "evidence",
  fee_receipt: "receipt",
  other: "other",
};

export function isImmigrationDocumentType(value: string | null | undefined): value is ImmigrationDocumentType {
  return (IMMIGRATION_DOCUMENT_TYPES as readonly string[]).includes(String(value ?? ""));
}

export function immigrationDocumentTypeLabel(type: string | null | undefined): string {
  if (isImmigrationDocumentType(type)) return TYPE_LABELS[type];
  const cleaned = String(type ?? "").replace(/_/g, " ").trim();
  return cleaned || TYPE_LABELS.other;
}

export function catalogKindForImmigrationDocumentType(type: string | null | undefined): string | null {
  if (!isImmigrationDocumentType(type) || type === "other") return null;
  return CATALOG_KIND_BY_TYPE[type];
}

export function declaredImmigrationTypeFromDocKind(docKind: string | null | undefined): ImmigrationDocumentType | "" {
  const key = String(docKind ?? "").toLowerCase().replace(/\s+/g, "_");
  if (key === "receipt" || key === "case_record" || key === "case_record_/_online_account") return "receipt_notice";
  if (key === "approval") return "approval_notice";
  if (key === "rfe") return "rfe";
  if (key === "form") return "uscis_form";
  if (key === "identity") return "identity_document";
  if (key === "relationship") return "relationship_civil_document";
  if (key === "declaration") return "personal_declaration";
  if (key === "evidence" || key === "proof" || key === "country_conditions" || key === "status_record") return "supporting_evidence";
  return "";
}

export function classifyImmigrationDocument(input: string): ImmigrationDocumentType {
  for (const hint of TYPE_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(input))) return hint.type;
  }
  return "other";
}

export function resolveImmigrationDocumentType(input: {
  fileName?: string | null;
  text?: string | null;
  declaredType?: string | null;
  docKind?: string | null;
}): ImmigrationDocumentType {
  const blob = `${input.fileName ?? ""}\n${input.text ?? ""}`;
  const fromContent = classifyImmigrationDocument(blob);
  if (fromContent !== "other") return fromContent;
  if (isImmigrationDocumentType(input.declaredType) && input.declaredType !== "other") {
    // Declared identity without identity cues must not win over an unclassified upload.
    if (input.declaredType === "identity_document" && !hasIdentityCues(blob)) {
      // fall through to docKind / other
    } else {
      return input.declaredType;
    }
  }
  const fromKind = declaredImmigrationTypeFromDocKind(input.docKind);
  // Phase A: upload UI often defaults docKind to "identity". That must not become
  // "Identity & Entry Document" unless the file/text actually looks like identity/travel.
  if (fromKind === "identity_document" && !hasIdentityCues(blob)) return "other";
  return fromKind || "other";
}

function hasIdentityCues(blob: string): boolean {
  return /\bpassport\b|\bvisa (?:foil|stamp|page)\b|\bnonimmigrant visa\b|\bimmigrant visa\b|\bbiographic page\b|\bnational id\b|\bi-?94\b/i.test(blob);
}

export function classifyUploadedDocument(input: {
  fileName?: string | null;
  text?: string | null;
  declaredType?: string | null;
  docKind?: string | null;
}): { documentType: ImmigrationDocumentType; docKind: string } {
  const documentType = resolveImmigrationDocumentType(input);
  const remappedKind = catalogKindForImmigrationDocumentType(documentType);
  const currentKind = String(input.docKind ?? "").trim() || "other";
  return {
    documentType,
    docKind: remappedKind && currentKind !== "avatar" ? remappedKind : currentKind,
  };
}
