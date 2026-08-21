CREATE TABLE IF NOT EXISTS "CaseReportDownload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "transactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaseReportDownload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseReportDownload_userId_createdAt_idx" ON "CaseReportDownload"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CaseReportDownload_caseId_idx" ON "CaseReportDownload"("caseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseReportDownload_userId_fkey') THEN
    ALTER TABLE "CaseReportDownload" ADD CONSTRAINT "CaseReportDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseReportDownload_caseId_fkey') THEN
    ALTER TABLE "CaseReportDownload" ADD CONSTRAINT "CaseReportDownload_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseReportDownload_transactionId_fkey') THEN
    ALTER TABLE "CaseReportDownload" ADD CONSTRAINT "CaseReportDownload_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
