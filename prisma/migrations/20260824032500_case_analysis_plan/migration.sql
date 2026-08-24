CREATE TABLE IF NOT EXISTS "CaseAnalysisPlan" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "versionId" TEXT,
  "complexity" TEXT NOT NULL DEFAULT 'LOW',
  "reasoningLevel" TEXT NOT NULL DEFAULT 'DIRECT',
  "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "humanReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "planJson" TEXT NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseAnalysisPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseAnalysisPlan_caseId_createdAt_idx" ON "CaseAnalysisPlan"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CaseAnalysisPlan_versionId_idx" ON "CaseAnalysisPlan"("versionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseAnalysisPlan_caseId_fkey') THEN
    ALTER TABLE "CaseAnalysisPlan" ADD CONSTRAINT "CaseAnalysisPlan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseAnalysisPlan_versionId_fkey') THEN
    ALTER TABLE "CaseAnalysisPlan" ADD CONSTRAINT "CaseAnalysisPlan_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "CaseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
