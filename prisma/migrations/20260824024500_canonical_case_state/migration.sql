CREATE TABLE IF NOT EXISTS "EvidenceSnapshot" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "hash" TEXT NOT NULL,
  "documentsJson" TEXT NOT NULL DEFAULT '[]',
  "factsJson" TEXT NOT NULL DEFAULT '[]',
  "eventsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CaseVersion" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'analysis',
  "status" TEXT NOT NULL DEFAULT 'created',
  "pipelineConfigVersion" TEXT NOT NULL DEFAULT '',
  "evidenceSnapshotId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CaseVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanonicalCaseState" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "versionId" TEXT,
  "evidenceSnapshotHash" TEXT NOT NULL DEFAULT '',
  "stateJson" TEXT NOT NULL DEFAULT '{}',
  "approvedStateJson" TEXT NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CanonicalCaseState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EvidenceSnapshot_caseId_hash_key" ON "EvidenceSnapshot"("caseId", "hash");
CREATE INDEX IF NOT EXISTS "EvidenceSnapshot_caseId_createdAt_idx" ON "EvidenceSnapshot"("caseId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "CaseVersion_caseId_version_key" ON "CaseVersion"("caseId", "version");
CREATE INDEX IF NOT EXISTS "CaseVersion_caseId_createdAt_idx" ON "CaseVersion"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CaseVersion_evidenceSnapshotId_idx" ON "CaseVersion"("evidenceSnapshotId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalCaseState_caseId_key" ON "CanonicalCaseState"("caseId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanonicalCaseState_versionId_key" ON "CanonicalCaseState"("versionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvidenceSnapshot_caseId_fkey') THEN
    ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseVersion_caseId_fkey') THEN
    ALTER TABLE "CaseVersion" ADD CONSTRAINT "CaseVersion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseVersion_evidenceSnapshotId_fkey') THEN
    ALTER TABLE "CaseVersion" ADD CONSTRAINT "CaseVersion_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "EvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanonicalCaseState_caseId_fkey') THEN
    ALTER TABLE "CanonicalCaseState" ADD CONSTRAINT "CanonicalCaseState_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CanonicalCaseState_versionId_fkey') THEN
    ALTER TABLE "CanonicalCaseState" ADD CONSTRAINT "CanonicalCaseState_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
