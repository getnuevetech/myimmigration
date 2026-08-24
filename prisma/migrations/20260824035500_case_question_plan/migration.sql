CREATE TABLE IF NOT EXISTS "CaseQuestionPlan" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "unknownKey" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "whyItMatters" TEXT NOT NULL DEFAULT '',
  "materiality" TEXT NOT NULL DEFAULT 'MEDIUM',
  "canExistingEvidenceAnswer" BOOLEAN NOT NULL DEFAULT false,
  "betterSourceAction" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseQuestionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CaseQuestionPlan_caseId_unknownKey_key" ON "CaseQuestionPlan"("caseId", "unknownKey");
CREATE INDEX IF NOT EXISTS "CaseQuestionPlan_caseId_status_priority_idx" ON "CaseQuestionPlan"("caseId", "status", "priority");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseQuestionPlan_caseId_fkey') THEN
    ALTER TABLE "CaseQuestionPlan" ADD CONSTRAINT "CaseQuestionPlan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
