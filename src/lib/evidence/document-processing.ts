import "server-only";
import crypto from "crypto";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/uploads";
import { rebuildCaseEvidenceState } from "./case-state";
import { compileImmigrationEvidence } from "./compiler";
import { extractUniversalDocumentIntelligence } from "./universal-extraction";
import { classifyUploadedDocument, declaredImmigrationTypeFromDocKind, type ImmigrationDocumentType } from "@/domain/documents";
import type { CompiledEvidenceState } from "./types";

export const EVIDENCE_EXTRACTION_SCHEMA_VERSION = "immigration-evidence-v1";

type DocumentForProcessing = {
  id: string;
  userId: string | null;
  guestSessionId: string | null;
  caseId: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  docKind: string;
};

export type ProcessedDocumentEvidence = {
  documentId: string;
  documentType: ImmigrationDocumentType;
  processingStatus: "extracted" | "needs_review";
  contentHash: string;
  factsCount: number;
  eventsCount: number;
};

function hashBuffer(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function declaredTypeFromDocKind(docKind: string): ImmigrationDocumentType | "" {
  return declaredImmigrationTypeFromDocKind(docKind);
}

async function extractReadableText(doc: DocumentForProcessing, buf: Buffer): Promise<string> {
  const textLike =
    doc.mimeType.startsWith("text/") ||
    /\.(txt|csv|md|log)$/i.test(doc.fileName) ||
    doc.mimeType === "application/json";
  const isPdf = doc.mimeType === "application/pdf" || /\.pdf$/i.test(doc.fileName);

  if (textLike) return buf.toString("utf-8").slice(0, 30000);
  if (!isPdf) return "";

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try {
      const result = await parser.getText();
      return String(result?.text ?? "").replace(/\u0000/g, "").trim().slice(0, 30000);
    } finally {
      await parser.destroy().catch(() => null);
    }
  } catch (err) {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("warning", "pdf_extract", `Could not extract evidence text from ${doc.fileName}`, String(err));
    return "";
  }
}

async function findDuplicateDocument(doc: DocumentForProcessing, contentHash: string): Promise<string | null> {
  if (!contentHash) return null;
  const scopes = [
    doc.caseId ? { caseId: doc.caseId } : null,
    doc.userId ? { userId: doc.userId } : null,
    doc.guestSessionId ? { guestSessionId: doc.guestSessionId } : null,
  ].filter((scope): scope is { caseId: string } | { userId: string } | { guestSessionId: string } => Boolean(scope));
  if (scopes.length === 0) return null;
  const duplicate = await db.document.findFirst({
    where: {
      id: { not: doc.id },
      contentHash,
      deletedAt: null,
      OR: scopes,
    },
    select: { id: true },
    orderBy: { uploadedAt: "asc" },
  });
  return duplicate?.id ?? null;
}

function extractedPayload(text: string, compiled: CompiledEvidenceState, fileName: string): string {
  const universalExtraction = extractUniversalDocumentIntelligence({
    fileName,
    documentType: compiled.documentType,
    text,
  });
  return JSON.stringify({
    schema_version: EVIDENCE_EXTRACTION_SCHEMA_VERSION,
    raw_text: text.slice(0, 4000),
    universal_extraction: universalExtraction,
    document_type: compiled.documentType,
    facts: compiled.facts,
    events: compiled.events,
    relationships: compiled.relationships,
    unknowns: compiled.unknowns,
    suppressed_questions: compiled.suppressedQuestions,
    audit: compiled.audit,
    reconstruction: compiled.reconstruction,
  });
}

export async function processDocumentEvidence(documentId: string): Promise<ProcessedDocumentEvidence | null> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      userId: true,
      guestSessionId: true,
      caseId: true,
      fileName: true,
      filePath: true,
      mimeType: true,
      docKind: true,
    },
  });
  if (!doc) return null;

  await db.document.update({ where: { id: documentId }, data: { processingStatus: "extracting" } });

  try {
    const buf = await readUpload(doc.filePath);
    const contentHash = hashBuffer(buf);
    const text = await extractReadableText(doc, buf);
    const declaredType = declaredTypeFromDocKind(doc.docKind);
    const classified = classifyUploadedDocument({
      fileName: doc.fileName,
      text,
      declaredType,
      docKind: doc.docKind,
    });
    const compiled = compileImmigrationEvidence({
      id: doc.id,
      fileName: doc.fileName,
      text,
      declaredType,
    });
    const duplicateOfId = await findDuplicateDocument(doc, contentHash);
    const processingStatus = text ? "extracted" : "needs_review";

    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: {
          documentType: classified.documentType,
          docKind: classified.docKind,
          processingStatus,
          status: text ? "extracted" : "verification_required",
          contentHash,
          extractionSchemaVersion: EVIDENCE_EXTRACTION_SCHEMA_VERSION,
          duplicateOfId,
          extractedJson: text ? extractedPayload(text, compiled, doc.fileName) : JSON.stringify({
            schema_version: EVIDENCE_EXTRACTION_SCHEMA_VERSION,
            document_type: compiled.documentType,
            universal_extraction: extractUniversalDocumentIntelligence({ fileName: doc.fileName, documentType: compiled.documentType, text }),
            needs_review_reason: "No machine-readable text was available for evidence extraction.",
          }),
        },
      });

      if (!doc.caseId) return;

      await tx.evidenceFact.deleteMany({ where: { documentId: doc.id } });
      await tx.caseEvent.deleteMany({ where: { documentId: doc.id } });
      await tx.evidenceRelationship.deleteMany({ where: { sourceDocumentId: doc.id } });

      // Duplicate of an earlier document: keep the pointer, do not double-write facts/events.
      if (duplicateOfId || !text) return;

      if (compiled.facts.length > 0) {
        await tx.evidenceFact.createMany({
          data: compiled.facts.map((item) => ({
            caseId: doc.caseId!,
            documentId: doc.id,
            key: item.key,
            value: item.value,
            valueJson: item.valueJson === undefined ? "" : JSON.stringify(item.valueJson),
            confidence: item.confidence,
            provenance: "DOCUMENT_EXTRACTED",
            verificationState: item.confidence === "confirmed" ? "VERIFIED" : "EXTRACTED",
            sourceId: doc.id,
            sourceAnchorJson: JSON.stringify({
              documentId: doc.id,
              documentType: compiled.documentType,
              fileName: doc.fileName,
              label: item.sourceText ?? "",
            }),
            sourceText: item.sourceText ?? "",
            observedAt: item.observedAt ? new Date(item.observedAt) : undefined,
            effectiveTime: item.observedAt ? new Date(item.observedAt) : undefined,
          })),
        });
      }

      if (compiled.events.length > 0) {
        await tx.caseEvent.createMany({
          data: compiled.events.map((item) => ({
            caseId: doc.caseId!,
            documentId: doc.id,
            eventType: item.eventType,
            title: item.title,
            description: item.description ?? "",
            dateText: item.dateText ?? "",
            occurredAt: item.occurredAt ? new Date(item.occurredAt) : undefined,
            evidenceJson: JSON.stringify(item.evidence.map((fact) => ({ key: fact.key, value: fact.value }))),
            sortOrder: item.sortOrder,
          })),
        });
      }

      if (compiled.relationships.length > 0) {
        await tx.evidenceRelationship.createMany({
          data: compiled.relationships.map((item) => ({
            caseId: doc.caseId!,
            sourceDocumentId: doc.id,
            relationType: item.relationType,
            fromFactKey: item.fromFactKey,
            fromValue: item.fromValue,
            toFactKey: item.toFactKey,
            toValue: item.toValue,
            confidence: item.confidence,
            rationale: item.rationale,
          })),
        });
      }
    });

    if (doc.caseId) await rebuildCaseEvidenceState(doc.caseId);

    return {
      documentId,
      documentType: compiled.documentType,
      processingStatus,
      contentHash,
      factsCount: text ? compiled.facts.length : 0,
      eventsCount: text ? compiled.events.length : 0,
    };
  } catch (err) {
    await db.document.update({
      where: { id: documentId },
      data: { processingStatus: "failed", status: "verification_required" },
    }).catch(() => null);
    throw err;
  }
}

export async function processDocumentsEvidence(documentIds: string[]): Promise<ProcessedDocumentEvidence[]> {
  const results: ProcessedDocumentEvidence[] = [];
  for (const documentId of documentIds) {
    const result = await processDocumentEvidence(documentId);
    if (result) results.push(result);
  }
  return results;
}
