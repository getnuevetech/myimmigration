import type { ImmigrationDocumentType } from "@/domain/documents";

export type AuthorityRank =
  | "USCIS_GOVERNMENT_DOCUMENT"
  | "FILED_FORM_OR_OFFICIAL_RECEIPT"
  | "CIVIL_OR_PROFESSIONAL_RECORD"
  | "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT"
  | "CUSTOMER_STATEMENT"
  | "AI_INFERENCE";

export type SourceChannel = "CUSTOMER_UPLOAD" | "STAFF_UPLOAD" | "SYSTEM_IMPORT" | "USER_STATEMENT";

export type Issuer =
  | "USCIS"
  | "DOJ"
  | "DOS"
  | "EOIR"
  | "STATE_VITAL_RECORDS"
  | "CUSTOMER"
  | "UNKNOWN";

/** Authority follows issuer + document type, not upload channel. */
export function authorityForDocumentType(documentType: string | null | undefined): {
  issuer: Issuer;
  authority_rank: AuthorityRank;
} {
  const type = String(documentType ?? "");
  if (
    type.startsWith("uscis_") ||
    ["rfe", "noid", "approval_notice", "denial_notice", "biometrics_notice", "interview_notice", "i797_notice", "receipt_notice", "case_status_record", "aos_filing_record", "fee_receipt"].includes(type)
  ) {
    return { issuer: "USCIS", authority_rank: "USCIS_GOVERNMENT_DOCUMENT" };
  }
  if (type === "relationship_civil_document") {
    return { issuer: "STATE_VITAL_RECORDS", authority_rank: "CIVIL_OR_PROFESSIONAL_RECORD" };
  }
  if (type === "personal_declaration") {
    return { issuer: "CUSTOMER", authority_rank: "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT" };
  }
  if (type === "admission_entry_record" || type === "identity_document") {
    return { issuer: "UNKNOWN", authority_rank: "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT" };
  }
  return { issuer: "UNKNOWN", authority_rank: "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT" };
}

export function formatContentHash(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return value.startsWith("sha256:") ? value : `sha256:${value}`;
}

export function buildDocumentFactSource(input: {
  documentId: string;
  contentHash?: string | null;
  documentType?: string | null;
  extractedField?: string;
  sourcePage?: number | null;
  sourceChannel?: SourceChannel;
}): Record<string, unknown> {
  const auth = authorityForDocumentType(input.documentType);
  return {
    source_type: "DOCUMENT",
    document_id: input.documentId,
    content_hash: formatContentHash(input.contentHash),
    document_type: input.documentType ?? "other",
    extracted_field: input.extractedField ?? "document_type",
    source_page: input.sourcePage ?? 1,
    source_channel: input.sourceChannel ?? "CUSTOMER_UPLOAD",
    issuer: auth.issuer,
    authority_rank: auth.authority_rank,
  };
}

export function isUscisGovernmentType(documentType: string | null | undefined): boolean {
  return authorityForDocumentType(documentType).authority_rank === "USCIS_GOVERNMENT_DOCUMENT";
}

export type { ImmigrationDocumentType };
