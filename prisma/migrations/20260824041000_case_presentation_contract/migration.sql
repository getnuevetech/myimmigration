CREATE TABLE IF NOT EXISTS "CasePresentation" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "versionId" TEXT,
  "heroJson" TEXT NOT NULL DEFAULT '{}',
  "whatThisMeansJson" TEXT NOT NULL DEFAULT '{}',
  "timelineJson" TEXT NOT NULL DEFAULT '[]',
  "findingsJson" TEXT NOT NULL DEFAULT '[]',
  "deadlinesJson" TEXT NOT NULL DEFAULT '[]',
  "actionsJson" TEXT NOT NULL DEFAULT '[]',
  "evidenceJson" TEXT NOT NULL DEFAULT '[]',
  "professionalReviewJson" TEXT NOT NULL DEFAULT 'null',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CasePresentation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CasePresentation_caseId_createdAt_idx" ON "CasePresentation"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CasePresentation_versionId_idx" ON "CasePresentation"("versionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CasePresentation_caseId_fkey') THEN
    ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CasePresentation_versionId_fkey') THEN
    ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
