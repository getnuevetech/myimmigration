-- Evidence runtime schema for ImmigrationOnMe v3.2 parity.
-- Idempotent because some environments may have been advanced with `prisma db push`.

ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "evidenceAvailableScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "evidenceProcessedScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "actionReadinessScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "contentHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "extractionSchemaVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "duplicateOfId" TEXT;

ALTER TABLE "QaThread" ADD COLUMN IF NOT EXISTS "caseId" TEXT;

CREATE TABLE IF NOT EXISTS "EvidenceFact" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "documentId" TEXT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "valueJson" TEXT NOT NULL DEFAULT '',
  "confidence" TEXT NOT NULL DEFAULT 'needs_verification',
  "sourceText" TEXT NOT NULL DEFAULT '',
  "sourcePage" INTEGER,
  "observedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "documentId" TEXT,
  "eventType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "dateText" TEXT NOT NULL DEFAULT '',
  "occurredAt" TIMESTAMP(3),
  "evidenceJson" TEXT NOT NULL DEFAULT '[]',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceRelationship" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "sourceDocumentId" TEXT,
  "relationType" TEXT NOT NULL,
  "fromFactKey" TEXT NOT NULL,
  "fromValue" TEXT NOT NULL,
  "toFactKey" TEXT NOT NULL,
  "toValue" TEXT NOT NULL,
  "confidence" TEXT NOT NULL DEFAULT 'needs_verification',
  "rationale" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceAudit" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'needs_more_evidence',
  "summary" TEXT NOT NULL DEFAULT '',
  "blockingUnknownsJson" TEXT NOT NULL DEFAULT '[]',
  "warningsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseReconstruction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "currentPosition" TEXT NOT NULL DEFAULT '',
  "timelineJson" TEXT NOT NULL DEFAULT '[]',
  "pendingActionsJson" TEXT NOT NULL DEFAULT '[]',
  "confidence" TEXT NOT NULL DEFAULT 'needs_verification',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseReconstruction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseUnknown" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseUnknown_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SuppressedQuestion" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceFactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SuppressedQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Document_caseId_documentType_idx" ON "Document"("caseId", "documentType");
CREATE INDEX IF NOT EXISTS "Document_processingStatus_idx" ON "Document"("processingStatus");
CREATE INDEX IF NOT EXISTS "Document_contentHash_idx" ON "Document"("contentHash");
CREATE INDEX IF NOT EXISTS "QaThread_caseId_idx" ON "QaThread"("caseId");
CREATE INDEX IF NOT EXISTS "EvidenceFact_caseId_key_idx" ON "EvidenceFact"("caseId", "key");
CREATE INDEX IF NOT EXISTS "EvidenceFact_documentId_idx" ON "EvidenceFact"("documentId");
CREATE INDEX IF NOT EXISTS "CaseEvent_caseId_eventType_idx" ON "CaseEvent"("caseId", "eventType");
CREATE INDEX IF NOT EXISTS "CaseEvent_documentId_idx" ON "CaseEvent"("documentId");
CREATE INDEX IF NOT EXISTS "EvidenceRelationship_caseId_relationType_idx" ON "EvidenceRelationship"("caseId", "relationType");
CREATE INDEX IF NOT EXISTS "EvidenceRelationship_sourceDocumentId_idx" ON "EvidenceRelationship"("sourceDocumentId");
CREATE INDEX IF NOT EXISTS "EvidenceAudit_caseId_createdAt_idx" ON "EvidenceAudit"("caseId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CaseReconstruction_caseId_key" ON "CaseReconstruction"("caseId");
CREATE UNIQUE INDEX IF NOT EXISTS "CaseUnknown_caseId_key_key" ON "CaseUnknown"("caseId", "key");
CREATE INDEX IF NOT EXISTS "SuppressedQuestion_caseId_questionKey_idx" ON "SuppressedQuestion"("caseId", "questionKey");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Document_duplicateOfId_fkey') THEN
    ALTER TABLE "Document" ADD CONSTRAINT "Document_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QaThread_caseId_fkey') THEN
    ALTER TABLE "QaThread" ADD CONSTRAINT "QaThread_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceFact_caseId_fkey') THEN
    ALTER TABLE "EvidenceFact" ADD CONSTRAINT "EvidenceFact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceFact_documentId_fkey') THEN
    ALTER TABLE "EvidenceFact" ADD CONSTRAINT "EvidenceFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseEvent_caseId_fkey') THEN
    ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseEvent_documentId_fkey') THEN
    ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceRelationship_caseId_fkey') THEN
    ALTER TABLE "EvidenceRelationship" ADD CONSTRAINT "EvidenceRelationship_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceRelationship_sourceDocumentId_fkey') THEN
    ALTER TABLE "EvidenceRelationship" ADD CONSTRAINT "EvidenceRelationship_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceAudit_caseId_fkey') THEN
    ALTER TABLE "EvidenceAudit" ADD CONSTRAINT "EvidenceAudit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseReconstruction_caseId_fkey') THEN
    ALTER TABLE "CaseReconstruction" ADD CONSTRAINT "CaseReconstruction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseUnknown_caseId_fkey') THEN
    ALTER TABLE "CaseUnknown" ADD CONSTRAINT "CaseUnknown_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SuppressedQuestion_caseId_fkey') THEN
    ALTER TABLE "SuppressedQuestion" ADD CONSTRAINT "SuppressedQuestion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
