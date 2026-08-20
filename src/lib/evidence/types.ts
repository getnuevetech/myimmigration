import type { ImmigrationDocumentType } from "@/domain/documents";
import type { ImmigrationEventType } from "@/domain/events";
import type { ImmigrationFactKey } from "@/domain/facts";

export type EvidenceConfidence = "confirmed" | "likely" | "possible" | "needs_verification" | "not_supported";

export type EvidenceSourceKind = "document" | "case_input" | "clarification" | "system";

export type EvidenceSource = {
  kind: EvidenceSourceKind;
  documentId?: string;
  documentType?: ImmigrationDocumentType;
  label?: string;
};

export type CompiledEvidenceFact = {
  key: ImmigrationFactKey;
  value: string;
  valueJson?: unknown;
  confidence: EvidenceConfidence;
  source: EvidenceSource;
  sourceText?: string;
  observedAt?: string;
};

export type CompiledCaseEvent = {
  eventType: ImmigrationEventType;
  title: string;
  description?: string;
  dateText?: string;
  occurredAt?: string;
  evidence: CompiledEvidenceFact[];
  sortOrder: number;
};

export type CompiledEvidenceRelationship = {
  relationType: "same_receipt" | "same_form" | "notice_for_receipt" | "deadline_for_notice";
  fromFactKey: ImmigrationFactKey;
  fromValue: string;
  toFactKey: ImmigrationFactKey;
  toValue: string;
  confidence: EvidenceConfidence;
  rationale: string;
};

export type CompiledCaseUnknown = {
  key: string;
  question: string;
  reason: string;
};

export type CompiledSuppressedQuestion = {
  questionKey: string;
  question: string;
  reason: string;
  evidenceFactKey: ImmigrationFactKey;
};

export type EvidenceAuditStatus = "pass" | "needs_more_evidence" | "needs_review" | "blocked";

export type CompiledEvidenceAudit = {
  status: EvidenceAuditStatus;
  summary: string;
  blockingUnknowns: string[];
  warnings: string[];
};

export type CompiledCaseReconstruction = {
  summary: string;
  currentPosition: string;
  timeline: CompiledCaseEvent[];
  pendingActions: string[];
  confidence: EvidenceConfidence;
};

export type EvidenceDocumentInput = {
  id?: string;
  fileName?: string;
  text: string;
  declaredType?: ImmigrationDocumentType | "other" | "";
};

export type CompiledEvidenceState = {
  documentType: ImmigrationDocumentType;
  facts: CompiledEvidenceFact[];
  events: CompiledCaseEvent[];
  relationships: CompiledEvidenceRelationship[];
  unknowns: CompiledCaseUnknown[];
  suppressedQuestions: CompiledSuppressedQuestion[];
  audit: CompiledEvidenceAudit;
  reconstruction: CompiledCaseReconstruction;
};
