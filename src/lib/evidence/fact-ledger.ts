import { buildDocumentFactSource, formatContentHash } from "./authority";

export type LedgerFactStatus = "VERIFIED" | "REPORTED" | "UNKNOWN";

export type LedgerClaimKind = "CONFLICT" | "UNVERIFIED_CLAIM" | "EVIDENCE_GAP";

export type LedgerFact = {
  fact_id: string;
  status: LedgerFactStatus;
  value: unknown;
  sources: Record<string, unknown>[];
  kind?: LedgerClaimKind;
  blocks_goal_progress?: boolean;
  allowed_values?: string[];
  note?: string;
  promotion_on?: { when_evidence: string; becomes: LedgerFactStatus };
};

export type LedgerPosture = {
  posture_id: string;
  value: string;
  supersedes: string | null;
  superseded_by: string | null;
};

export type LedgerTimelineEvent = {
  event_id: string;
  fact_id: string;
  status?: string;
  superseded_by: null;
};

export type FactLedger = {
  version: 1;
  facts: LedgerFact[];
  conflicts: unknown[];
  unverified_claims: Record<string, unknown>[];
  evidence_gaps: Record<string, unknown>[];
  event_timeline: LedgerTimelineEvent[];
  current_posture: LedgerPosture | null;
  built_at: string;
};

export type FactLedgerDocument = {
  id: string;
  fileName?: string | null;
  documentType?: string | null;
  contentHash?: string | null;
  text?: string | null;
};

export type FactLedgerInput = {
  situation?: string | null;
  goal?: string | null;
  clarifyText?: string | null;
  documents?: FactLedgerDocument[];
};

const VAWA_RE = /\bvawa\b|self-petition|prima facie/i;
const MARRIED_USC_RE = /\bmarried to (?:a )?(?:u\.?s\.?|united states) citizen\b|\b(?:u\.?s\.?|united states) citizen (?:spouse|husband|wife)\b/i;
const ADJUSTMENT_FILED_RE = /\b(?:previously |already )?filed (?:for )?(?:adjustment of status|form i-?485|an? i-?485)\b|\bi-?485 (?:was )?filed\b/i;
const WAIVER_RE = /\bwaiver\b/i;
const MEDICAL_MISSING_RE = /\b(?:have not|haven't|not yet) (?:completed|done|had).{0,40}medical\b/i;

function hasType(docs: FactLedgerDocument[], type: string): FactLedgerDocument | undefined {
  return docs.find((doc) => doc.documentType === type);
}

function narrative(input: FactLedgerInput): string {
  return [input.situation, input.goal, input.clarifyText].map((v) => String(v ?? "")).join("\n");
}

function sourceForDoc(doc: FactLedgerDocument, extractedField: string): Record<string, unknown> {
  return buildDocumentFactSource({
    documentId: doc.id,
    contentHash: doc.contentHash,
    documentType: doc.documentType,
    extractedField,
  });
}

function userStatementSource(): Record<string, unknown> {
  return {
    source_type: "USER_STATEMENT",
    source_channel: "USER_STATEMENT",
    issuer: "CUSTOMER",
    authority_rank: "CUSTOMER_STATEMENT",
  };
}

/**
 * Derive the golden material fact ledger for a case.
 * Resolve UNKNOWN vs promote REPORTED→VERIFIED are distinct operations represented here.
 */
export function buildFactLedger(input: FactLedgerInput = {}): FactLedger {
  const docs = input.documents ?? [];
  const text = narrative(input);
  const facts: LedgerFact[] = [];
  const unverified_claims: Record<string, unknown>[] = [];
  const evidence_gaps: Record<string, unknown>[] = [];

  const i360Receipt = hasType(docs, "uscis_i360_receipt_notice");
  const primaFacie = hasType(docs, "uscis_vawa_prima_facie_notice");
  const marriageCert = hasType(docs, "relationship_civil_document");
  const i485Receipt = hasType(docs, "aos_filing_record");
  const hasI360Narrative = VAWA_RE.test(text) || /\bi-?360\b/i.test(text) || Boolean(i360Receipt) || Boolean(primaFacie);
  const reportsI485 = ADJUSTMENT_FILED_RE.test(text) || Boolean(i485Receipt);
  const marriedUsc = MARRIED_USC_RE.test(text);

  if (i360Receipt) {
    facts.push({
      fact_id: "FORM_I360_FILED",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(i360Receipt, "form_number")],
      note: "Promoted from I-360 receipt documentary evidence",
    });
    facts.push({
      fact_id: "I360_RECEIPT_ISSUED",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(i360Receipt, "notice_type")],
    });
  } else if (hasI360Narrative) {
    facts.push({
      fact_id: "FORM_I360_FILED",
      status: "REPORTED",
      value: true,
      sources: [userStatementSource()],
      kind: "UNVERIFIED_CLAIM",
      promotion_on: {
        when_evidence: "I360_RECEIPT verified from USCIS receipt document",
        becomes: "VERIFIED",
      },
    });
  }

  if (primaFacie) {
    facts.push({
      fact_id: "PRIMA_FACIE_DETERMINATION_ISSUED",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(primaFacie, "notice_type")],
    });
  }

  if (marriageCert) {
    facts.push({
      fact_id: "MARRIAGE_EXISTS",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(marriageCert, "document_type")],
      note: "Civil marriage record verifies marriage existence; does not alone establish spouse citizenship",
    });
  }

  if (marriedUsc) {
    facts.push({
      fact_id: "SPOUSE_US_CITIZEN",
      status: "REPORTED",
      value: true,
      sources: [userStatementSource()],
      kind: "UNVERIFIED_CLAIM",
    });
  }

  if (i485Receipt) {
    facts.push({
      fact_id: "FORM_I485_FILED",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(i485Receipt, "form_number")],
      note: "Promoted from I-485 receipt",
    });
    facts.push({
      fact_id: "I485_RECEIPT",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(i485Receipt, "notice_type")],
    });
  } else if (reportsI485) {
    facts.push({
      fact_id: "FORM_I485_FILED",
      status: "REPORTED",
      value: true,
      sources: [userStatementSource()],
      kind: "UNVERIFIED_CLAIM",
      promotion_on: {
        when_evidence: "I485_RECEIPT verified from USCIS receipt document",
        becomes: "VERIFIED",
      },
    });
    facts.push({
      fact_id: "I485_RECEIPT",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    unverified_claims.push({
      subject: "FORM_I485_FILED",
      reported: "Customer reports prior I-485 filing",
      available_evidence: null,
      status: "REPORTED",
      required_action: "UPLOAD_I485_RECEIPT",
      not_a_conflict_because: "Absence of a receipt fails to verify the filing; it does not contradict the statement",
    });
    evidence_gaps.push({
      subject: "I485_RECEIPT",
      status: "UNKNOWN",
      required_action: "UPLOAD_I485_RECEIPT",
    });
  }

  if (WAIVER_RE.test(text)) {
    facts.push({
      fact_id: "WAIVER_RECEIVED",
      status: "REPORTED",
      value: true,
      sources: [userStatementSource()],
    });
    facts.push({
      fact_id: "WAIVER_TYPE",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({ subject: "WAIVER_TYPE", status: "UNKNOWN", required_action: "UPLOAD_WAIVER_NOTICE" });
  }

  if (MEDICAL_MISSING_RE.test(text)) {
    facts.push({
      fact_id: "MEDICAL_NOT_COMPLETED",
      status: "REPORTED",
      value: true,
      sources: [userStatementSource()],
    });
  }

  if (hasI360Narrative || i360Receipt || primaFacie) {
    facts.push({
      fact_id: "I360_FINAL_DECISION",
      status: "UNKNOWN",
      value: "UNKNOWN",
      allowed_values: ["APPROVED", "DENIED", "WITHDRAWN", "UNKNOWN"],
      sources: [],
      kind: "EVIDENCE_GAP",
    });
    facts.push({
      fact_id: "LATER_I360_ACTION",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({
      subject: "LATER_I360_ACTION",
      status: "UNKNOWN",
      required_action: "UPLOAD_POST_PRIMA_FACIE_NOTICES",
    });
    evidence_gaps.push({
      subject: "I485_FINAL_DECISION",
      status: "UNKNOWN",
      illustrative_unverified_if_customer_claims_approved: {
        classification: "UNVERIFIED_CLAIM + EVIDENCE_GAP — not CONFLICT",
        note: "A receipt does not contradict approval",
      },
    });
  }

  if (reportsI485 && !i485Receipt) {
    facts.push({
      fact_id: "CURRENT_I485_STATUS",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({
      subject: "CURRENT_I485_STATUS",
      status: "UNKNOWN",
      required_action: "CONFIRM_I485_PROCEDURAL_STATUS",
    });
  }

  const event_timeline: LedgerTimelineEvent[] = [];
  if (i360Receipt) {
    event_timeline.push({ event_id: "EVT_I360_RECEIPT", fact_id: "I360_RECEIPT_ISSUED", superseded_by: null });
  }
  if (primaFacie) {
    event_timeline.push({ event_id: "EVT_PRIMA_FACIE", fact_id: "PRIMA_FACIE_DETERMINATION_ISSUED", superseded_by: null });
  }
  event_timeline.push({
    event_id: "EVT_LATER_ACTION",
    fact_id: "LATER_I360_ACTION",
    status: "UNKNOWN_PENDING_EVIDENCE",
    superseded_by: null,
  });
  event_timeline.push({
    event_id: "EVT_FINAL_DECISION",
    fact_id: "I360_FINAL_DECISION",
    status: "UNKNOWN",
    superseded_by: null,
  });

  let current_posture: LedgerPosture | null = null;
  if (primaFacie) {
    current_posture = {
      posture_id: "I360_CURRENT_POSTURE",
      value: "PRIMA_FACIE_PENDING",
      supersedes: "FILED_PENDING",
      superseded_by: null,
    };
  } else if (i360Receipt) {
    current_posture = {
      posture_id: "I360_CURRENT_POSTURE",
      value: "FILED_PENDING",
      supersedes: null,
      superseded_by: null,
    };
  }

  return {
    version: 1,
    facts,
    conflicts: [],
    unverified_claims,
    evidence_gaps,
    event_timeline,
    current_posture,
    built_at: new Date().toISOString(),
  };
}

/** Genuine conflict only: two affirmative incompatible values. Never receipt vs approval. */
export function isGenuineOutcomeConflict(sourceA: string, sourceB: string): boolean {
  const a = sourceA.toUpperCase();
  const b = sourceB.toUpperCase();
  if (a.includes("RECEIPT") || b.includes("RECEIPT") || a.includes("RECEIPT_ONLY") || b.includes("RECEIPT_ONLY")) {
    return false;
  }
  const outcomes = ["APPROVED", "DENIED", "WITHDRAWN"];
  const aOut = outcomes.find((o) => a.includes(o));
  const bOut = outcomes.find((o) => b.includes(o));
  return Boolean(aOut && bOut && aOut !== bOut);
}

export function ledgerFact(ledger: FactLedger, factId: string): LedgerFact | undefined {
  return ledger.facts.find((fact) => fact.fact_id === factId);
}

export function formatHashForDisplay(hash: string | null | undefined): string {
  return formatContentHash(hash);
}
