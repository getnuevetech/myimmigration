import "server-only";
import { IMMIGRATION_EVENT_TYPES, type ImmigrationEventType } from "@/domain/events";
import { isImmigrationFactKey, type ImmigrationFactKey } from "@/domain/facts";
import type { ImmigrationDocumentType } from "@/domain/documents";
import { db } from "@/lib/db";
import { buildEvidenceGateBrief } from "./gate";
import type { CompiledCaseEvent, CompiledCaseUnknown, CompiledEvidenceAudit, CompiledEvidenceFact, CompiledSuppressedQuestion, EvidenceConfidence } from "./types";

const CONFIDENCE_VALUES: EvidenceConfidence[] = ["confirmed", "likely", "possible", "needs_verification", "not_supported"];
const AUDIT_STATUSES: CompiledEvidenceAudit["status"][] = ["pass", "needs_more_evidence", "needs_review", "blocked"];

function confidence(value: string): EvidenceConfidence {
  return CONFIDENCE_VALUES.includes(value as EvidenceConfidence) ? (value as EvidenceConfidence) : "needs_verification";
}

function auditStatus(value: string): CompiledEvidenceAudit["status"] {
  return AUDIT_STATUSES.includes(value as CompiledEvidenceAudit["status"]) ? (value as CompiledEvidenceAudit["status"]) : "needs_more_evidence";
}

function eventType(value: string): ImmigrationEventType {
  return (IMMIGRATION_EVENT_TYPES as readonly string[]).includes(value) ? (value as ImmigrationEventType) : "case_status_updated";
}

function parseStringArray(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function getCaseEvidenceGateBrief(caseId: string) {
  const [audit, reconstruction, facts, events, unknowns, suppressedQuestions] = await Promise.all([
    db.evidenceAudit.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" } }),
    db.caseReconstruction.findUnique({ where: { caseId } }),
    db.evidenceFact.findMany({
      where: { caseId },
      include: { document: { select: { id: true, fileName: true, documentType: true } } },
      orderBy: { createdAt: "asc" },
      take: 80,
    }),
    db.caseEvent.findMany({
      where: { caseId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 40,
    }),
    db.caseUnknown.findMany({ where: { caseId }, orderBy: { createdAt: "asc" }, take: 20 }),
    db.suppressedQuestion.findMany({ where: { caseId }, orderBy: { createdAt: "asc" }, take: 20 }),
  ]);

  const compiledFacts: CompiledEvidenceFact[] = facts
    .filter((fact) => isImmigrationFactKey(fact.key))
    .map((fact) => ({
      key: fact.key as ImmigrationFactKey,
      value: fact.value,
      confidence: confidence(fact.confidence),
      source: {
        kind: "document",
        documentId: fact.documentId ?? undefined,
        documentType: (fact.document?.documentType || "other") as ImmigrationDocumentType,
        label: fact.document?.fileName,
      },
      sourceText: fact.sourceText || undefined,
      observedAt: fact.observedAt?.toISOString(),
    }));

  const compiledEvents: CompiledCaseEvent[] = events.map((item, index) => ({
    eventType: eventType(item.eventType),
    title: item.title,
    description: item.description || undefined,
    dateText: item.dateText || undefined,
    occurredAt: item.occurredAt?.toISOString(),
    evidence: [],
    sortOrder: index,
  }));

  const compiledUnknowns: CompiledCaseUnknown[] = unknowns.map((item) => ({
    key: item.key,
    question: item.question,
    reason: item.reason,
  }));

  const compiledSuppressed: CompiledSuppressedQuestion[] = suppressedQuestions
    .filter((item) => isImmigrationFactKey(item.evidenceFactId || item.questionKey))
    .map((item) => ({
      questionKey: item.questionKey,
      question: item.question,
      reason: item.reason,
      evidenceFactKey: (item.evidenceFactId || item.questionKey) as ImmigrationFactKey,
    }));

  return buildEvidenceGateBrief({
    audit: {
      status: audit ? auditStatus(audit.status) : "needs_more_evidence",
      summary: audit?.summary || "No compiled evidence audit exists yet.",
      blockingUnknowns: audit ? parseStringArray(audit.blockingUnknownsJson) : [],
      warnings: audit ? parseStringArray(audit.warningsJson) : [],
    },
    reconstruction: {
      summary: reconstruction?.summary || "No case reconstruction exists yet.",
      currentPosition: reconstruction?.currentPosition || "Case posture needs verification",
      pendingActions: reconstruction ? parseStringArray(reconstruction.pendingActionsJson) : [],
    },
    facts: compiledFacts,
    events: compiledEvents,
    unknowns: compiledUnknowns,
    suppressedQuestions: compiledSuppressed,
  });
}
