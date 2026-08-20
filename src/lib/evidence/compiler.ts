import { classifyImmigrationDocument, type ImmigrationDocumentType } from "@/domain/documents";
import type { ImmigrationEventType } from "@/domain/events";
import type { ImmigrationFactKey } from "@/domain/facts";
import type {
  CompiledCaseEvent,
  CompiledCaseReconstruction,
  CompiledCaseUnknown,
  CompiledEvidenceAudit,
  CompiledEvidenceFact,
  CompiledEvidenceRelationship,
  CompiledEvidenceState,
  CompiledSuppressedQuestion,
  EvidenceConfidence,
  EvidenceDocumentInput,
} from "./types";

const RECEIPT_RE = /\b[A-Z]{3}\d{10}\b/g;
const FORM_RE = /\b(?:Form\s+)?((?:I|N|G)-?\d{2,4}[A-Z]?)\b/gi;
const A_NUMBER_RE = /\bA[-\s]?\d{7,9}\b/gi;
const DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/gi;
const ISO_DATE_RE = /\b20\d{2}-\d{2}-\d{2}\b/g;
const NOTICE_PATTERNS: { value: string; pattern: RegExp; eventType: ImmigrationEventType }[] = [
  { value: "RFE", pattern: /\brequest for evidence\b|\bRFE\b/i, eventType: "rfe_issued" },
  { value: "NOID", pattern: /\bnotice of intent to deny\b|\bNOID\b/i, eventType: "noid_issued" },
  { value: "I-797", pattern: /\bI-?797C?\b|\bnotice of action\b/i, eventType: "notice_issued" },
  { value: "BIOMETRICS", pattern: /\bbiometrics?\b|\bfingerprint/i, eventType: "biometrics_scheduled" },
  { value: "INTERVIEW", pattern: /\binterview\b/i, eventType: "interview_scheduled" },
  { value: "APPROVAL", pattern: /\bapproval notice\b|\bapproved\b/i, eventType: "case_approved" },
  { value: "DENIAL", pattern: /\bdenial notice\b|\bdenied\b/i, eventType: "case_denied" },
];

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeForm(value: string): string {
  return value.toUpperCase().replace(/^FORM\s+/i, "").replace(/^([ING])(\d)/, "$1-$2");
}

function normalizeANumber(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "").replace(/^A-?/, "A-");
}

function firstDateNear(text: string, words: RegExp): string | undefined {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const matching = sentences.find((sentence) => words.test(sentence));
  return matching?.match(DATE_RE)?.[0] ?? matching?.match(ISO_DATE_RE)?.[0];
}

function inferConfidence(documentType: ImmigrationDocumentType, key: ImmigrationFactKey): EvidenceConfidence {
  if (documentType !== "other") return "confirmed";
  return key === "requested_evidence" ? "likely" : "needs_verification";
}

function fact(
  document: EvidenceDocumentInput,
  documentType: ImmigrationDocumentType,
  key: ImmigrationFactKey,
  value: string,
  sourceText?: string,
): CompiledEvidenceFact {
  return {
    key,
    value,
    confidence: inferConfidence(documentType, key),
    source: {
      kind: "document",
      documentId: document.id,
      documentType,
      label: document.fileName,
    },
    sourceText,
  };
}

function addFacts(
  out: CompiledEvidenceFact[],
  document: EvidenceDocumentInput,
  documentType: ImmigrationDocumentType,
  key: ImmigrationFactKey,
  values: string[],
): void {
  for (const value of uniq(values)) {
    out.push(fact(document, documentType, key, value));
  }
}

function factsByKey(facts: CompiledEvidenceFact[], key: ImmigrationFactKey): CompiledEvidenceFact[] {
  return facts.filter((item) => item.key === key);
}

function buildEvents(facts: CompiledEvidenceFact[], documentType: ImmigrationDocumentType): CompiledCaseEvent[] {
  const events: CompiledCaseEvent[] = [];
  const notice = factsByKey(facts, "notice_type")[0];
  const form = factsByKey(facts, "form_type")[0];
  const receipt = factsByKey(facts, "receipt_number")[0];
  const noticeDate = factsByKey(facts, "notice_date")[0];
  const receivedDate = factsByKey(facts, "received_date")[0];
  const deadline = factsByKey(facts, "response_deadline")[0] ?? factsByKey(facts, "appointment_date")[0];

  if (receipt || receivedDate) {
    events.push({
      eventType: "case_received",
      title: form ? `${form.value} received by USCIS` : "Case received by USCIS",
      dateText: receivedDate?.value,
      evidence: [receipt, form, receivedDate].filter(Boolean) as CompiledEvidenceFact[],
      sortOrder: events.length,
    });
  }

  if (notice) {
    const eventType = NOTICE_PATTERNS.find((item) => item.value === notice.value)?.eventType ?? "notice_issued";
    events.push({
      eventType,
      title: `${notice.value} notice identified`,
      dateText: noticeDate?.value,
      evidence: [notice, noticeDate, receipt].filter(Boolean) as CompiledEvidenceFact[],
      sortOrder: events.length,
    });
  }

  if (deadline) {
    events.push({
      eventType: documentType === "interview_notice" || deadline.key === "appointment_date" ? "interview_scheduled" : "response_due",
      title: deadline.key === "appointment_date" ? "Appointment date identified" : "Response deadline identified",
      dateText: deadline.value,
      evidence: [deadline, notice, receipt].filter(Boolean) as CompiledEvidenceFact[],
      sortOrder: events.length,
    });
  }

  return events;
}

function buildRelationships(facts: CompiledEvidenceFact[]): CompiledEvidenceRelationship[] {
  const relationships: CompiledEvidenceRelationship[] = [];
  const receipt = factsByKey(facts, "receipt_number")[0];
  const form = factsByKey(facts, "form_type")[0];
  const notice = factsByKey(facts, "notice_type")[0];
  const deadline = factsByKey(facts, "response_deadline")[0];

  if (receipt && notice) {
    relationships.push({
      relationType: "notice_for_receipt",
      fromFactKey: "notice_type",
      fromValue: notice.value,
      toFactKey: "receipt_number",
      toValue: receipt.value,
      confidence: "confirmed",
      rationale: "The notice and receipt number appear in the same immigration record.",
    });
  }

  if (receipt && form) {
    relationships.push({
      relationType: "same_receipt",
      fromFactKey: "form_type",
      fromValue: form.value,
      toFactKey: "receipt_number",
      toValue: receipt.value,
      confidence: "confirmed",
      rationale: "The form type and receipt number appear in the same immigration record.",
    });
  }

  if (deadline && notice) {
    relationships.push({
      relationType: "deadline_for_notice",
      fromFactKey: "response_deadline",
      fromValue: deadline.value,
      toFactKey: "notice_type",
      toValue: notice.value,
      confidence: "confirmed",
      rationale: "The response deadline appears in the same record as the notice type.",
    });
  }

  return relationships;
}

function buildUnknowns(facts: CompiledEvidenceFact[], documentType: ImmigrationDocumentType): CompiledCaseUnknown[] {
  const unknowns: CompiledCaseUnknown[] = [];
  if (factsByKey(facts, "receipt_number").length === 0) {
    unknowns.push({
      key: "receipt_number",
      question: "What receipt number is printed on the USCIS notice or case record?",
      reason: "Receipt numbers connect filings, notices, deadlines, and case status.",
    });
  }
  if (factsByKey(facts, "form_type").length === 0) {
    unknowns.push({
      key: "form_type",
      question: "Which immigration form does this record involve?",
      reason: "Form type determines the relevant USCIS process and evidence requirements.",
    });
  }
  if (["rfe", "noid"].includes(documentType) && factsByKey(facts, "response_deadline").length === 0) {
    unknowns.push({
      key: "response_deadline",
      question: "What response deadline is printed on the notice?",
      reason: "RFE and NOID deadlines control when the response must reach USCIS.",
    });
  }
  return unknowns;
}

function buildSuppressedQuestions(facts: CompiledEvidenceFact[]): CompiledSuppressedQuestion[] {
  const suppressed: CompiledSuppressedQuestion[] = [];
  const receipt = factsByKey(facts, "receipt_number")[0];
  const form = factsByKey(facts, "form_type")[0];
  const deadline = factsByKey(facts, "response_deadline")[0];

  if (receipt) {
    suppressed.push({
      questionKey: "receipt_number",
      question: "What is your USCIS receipt number?",
      reason: `The evidence already shows receipt number ${receipt.value}.`,
      evidenceFactKey: "receipt_number",
    });
  }
  if (form) {
    suppressed.push({
      questionKey: "form_type",
      question: "Which immigration form is this about?",
      reason: `The evidence already shows form ${form.value}.`,
      evidenceFactKey: "form_type",
    });
  }
  if (deadline) {
    suppressed.push({
      questionKey: "response_deadline",
      question: "What is the response deadline?",
      reason: `The evidence already shows deadline ${deadline.value}.`,
      evidenceFactKey: "response_deadline",
    });
  }

  return suppressed;
}

function buildAudit(facts: CompiledEvidenceFact[], unknowns: CompiledCaseUnknown[]): CompiledEvidenceAudit {
  const warnings: string[] = [];
  const hasReceipt = factsByKey(facts, "receipt_number").length > 0;
  const hasForm = factsByKey(facts, "form_type").length > 0;
  const hasNotice = factsByKey(facts, "notice_type").length > 0;

  if (!hasReceipt) warnings.push("No receipt number was found.");
  if (!hasForm) warnings.push("No form type was found.");
  if (!hasNotice) warnings.push("No notice type was found.");

  const blockingUnknowns = unknowns.map((item) => item.key);
  return {
    status: blockingUnknowns.length === 0 ? "pass" : hasReceipt || hasForm || hasNotice ? "needs_more_evidence" : "blocked",
    summary:
      blockingUnknowns.length === 0
        ? "The record has enough core identifiers for an evidence-first case reconstruction."
        : "The record was partially read, but important immigration identifiers are still missing.",
    blockingUnknowns,
    warnings,
  };
}

function buildReconstruction(facts: CompiledEvidenceFact[], events: CompiledCaseEvent[], audit: CompiledEvidenceAudit): CompiledCaseReconstruction {
  const receipt = factsByKey(facts, "receipt_number")[0]?.value;
  const form = factsByKey(facts, "form_type")[0]?.value;
  const notice = factsByKey(facts, "notice_type")[0]?.value;
  const status = factsByKey(facts, "case_status")[0]?.value;
  const pieces = [form, receipt, notice].filter(Boolean);
  const pendingActions = audit.blockingUnknowns.map((key) => `Confirm ${key.replace(/_/g, " ")}`);

  return {
    summary: pieces.length ? `Evidence identifies ${pieces.join(" / ")}.` : "Evidence does not yet identify the immigration case posture.",
    currentPosition: status ?? (notice ? `${notice} notice needs review` : "Case posture needs verification"),
    timeline: events,
    pendingActions,
    confidence: audit.status === "pass" ? "confirmed" : "needs_verification",
  };
}

export function compileImmigrationEvidence(document: EvidenceDocumentInput): CompiledEvidenceState {
  const text = document.text;
  const documentType =
    document.declaredType && document.declaredType !== "other"
      ? document.declaredType
      : classifyImmigrationDocument(`${document.fileName ?? ""}\n${text}`);
  const facts: CompiledEvidenceFact[] = [];

  addFacts(facts, document, documentType, "receipt_number", uniq(text.toUpperCase().match(RECEIPT_RE) ?? []));
  addFacts(
    facts,
    document,
    documentType,
    "form_type",
    uniq(Array.from(text.matchAll(FORM_RE)).map((match) => normalizeForm(match[1] ?? match[0]))),
  );
  addFacts(facts, document, documentType, "a_number", uniq((text.match(A_NUMBER_RE) ?? []).map(normalizeANumber)));

  for (const notice of NOTICE_PATTERNS) {
    if (notice.pattern.test(text)) facts.push(fact(document, documentType, "notice_type", notice.value));
  }

  const receivedDate = firstDateNear(text, /\breceived|receipt|accepted\b/i);
  if (receivedDate) facts.push(fact(document, documentType, "received_date", receivedDate));

  const noticeDate = firstDateNear(text, /\bnotice date|dated|issued\b/i);
  if (noticeDate) facts.push(fact(document, documentType, "notice_date", noticeDate));

  const responseDeadline = firstDateNear(text, /\brespond|response|reply|submit|deadline|due\b/i);
  if (responseDeadline) facts.push(fact(document, documentType, "response_deadline", responseDeadline));

  const appointmentDate = firstDateNear(text, /\bappointment|interview|biometrics\b/i);
  if (appointmentDate) facts.push(fact(document, documentType, "appointment_date", appointmentDate));

  const requestedEvidence = text.match(/\b(?:submit|provide|send|include)\b[^\n.]{0,180}\b(?:evidence|documents?|proof|records?|translations?)\b/gi) ?? [];
  addFacts(facts, document, documentType, "requested_evidence", requestedEvidence.map((item) => item.replace(/\s+/g, " ").trim()));

  const events = buildEvents(facts, documentType);
  const relationships = buildRelationships(facts);
  const unknowns = buildUnknowns(facts, documentType);
  const suppressedQuestions = buildSuppressedQuestions(facts);
  const audit = buildAudit(facts, unknowns);
  const reconstruction = buildReconstruction(facts, events, audit);

  return {
    documentType,
    facts,
    events,
    relationships,
    unknowns,
    suppressedQuestions,
    audit,
    reconstruction,
  };
}
