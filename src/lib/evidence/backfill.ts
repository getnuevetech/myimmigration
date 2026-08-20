import "server-only";
import { db } from "@/lib/db";
import { verifyCaseProgress } from "@/lib/case-progress";
import { EVIDENCE_EXTRACTION_SCHEMA_VERSION, processDocumentEvidence } from "./document-processing";

export type EvidenceBackfillResult = {
  documentsProcessed: number;
  documentsFailed: number;
  casesVerified: number;
};

export async function backfillEvidenceCases(limit = 5): Promise<EvidenceBackfillResult> {
  const documents = await db.document.findMany({
    where: {
      caseId: { not: null },
      deletedAt: null,
      docKind: { not: "avatar" },
      OR: [
        { extractionSchemaVersion: { not: EVIDENCE_EXTRACTION_SCHEMA_VERSION } },
        { processingStatus: { in: ["uploaded", "failed"] } },
      ],
    },
    select: { id: true, caseId: true },
    orderBy: { uploadedAt: "asc" },
    take: Math.max(1, limit),
  });

  let documentsProcessed = 0;
  let documentsFailed = 0;
  const caseIds = new Set<string>();
  for (const doc of documents) {
    if (doc.caseId) caseIds.add(doc.caseId);
    try {
      const result = await processDocumentEvidence(doc.id);
      if (result) documentsProcessed++;
    } catch {
      documentsFailed++;
    }
  }

  let casesVerified = 0;
  for (const caseId of caseIds) {
    await verifyCaseProgress(caseId).catch(() => null);
    casesVerified++;
  }

  return { documentsProcessed, documentsFailed, casesVerified };
}
