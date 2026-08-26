CREATE TABLE IF NOT EXISTS "AdminCaseReanalysis" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
  "visibleToConsultant" BOOLEAN NOT NULL DEFAULT false,
  "providerIdsJson" TEXT NOT NULL DEFAULT '[]',
  "currentSnapshotJson" TEXT NOT NULL DEFAULT '{}',
  "proposedSnapshotJson" TEXT NOT NULL DEFAULT '{}',
  "comparisonJson" TEXT NOT NULL DEFAULT '{}',
  "error" TEXT NOT NULL DEFAULT '',
  "sharedAt" TIMESTAMP(3),
  "overriddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminCaseReanalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminCaseReanalysis_caseId_createdAt_idx" ON "AdminCaseReanalysis"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminCaseReanalysis_adminUserId_createdAt_idx" ON "AdminCaseReanalysis"("adminUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminCaseReanalysis_status_idx" ON "AdminCaseReanalysis"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminCaseReanalysis_caseId_fkey') THEN
    ALTER TABLE "AdminCaseReanalysis" ADD CONSTRAINT "AdminCaseReanalysis_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminCaseReanalysis_adminUserId_fkey') THEN
    ALTER TABLE "AdminCaseReanalysis" ADD CONSTRAINT "AdminCaseReanalysis_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
