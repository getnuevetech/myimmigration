-- Phase E: approval gate audit trail + latest result on canonical state
ALTER TABLE "CanonicalCaseState" ADD COLUMN IF NOT EXISTS "gateResultJson" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS "CaseApprovalGateAudit" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "versionId" TEXT,
    "logicalAnalysisId" TEXT,
    "gateResult" TEXT NOT NULL DEFAULT 'PASS',
    "ruleIdsJson" TEXT NOT NULL DEFAULT '[]',
    "reasonsJson" TEXT NOT NULL DEFAULT '[]',
    "blocksJson" TEXT NOT NULL DEFAULT '[]',
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "auditJson" TEXT NOT NULL DEFAULT '{}',
    "overrideBy" TEXT NOT NULL DEFAULT '',
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "overrideAt" TIMESTAMP(3),
    "previousGateResult" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseApprovalGateAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseApprovalGateAudit_caseId_createdAt_idx" ON "CaseApprovalGateAudit"("caseId", "createdAt");
CREATE INDEX IF NOT EXISTS "CaseApprovalGateAudit_gateResult_idx" ON "CaseApprovalGateAudit"("gateResult");

DO $$ BEGIN
  ALTER TABLE "CaseApprovalGateAudit" ADD CONSTRAINT "CaseApprovalGateAudit_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
