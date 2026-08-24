CREATE TABLE IF NOT EXISTS "CaseActionNode" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL DEFAULT '',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "priority" INTEGER NOT NULL DEFAULT 1,
  "dependsOnJson" TEXT NOT NULL DEFAULT '[]',
  "resolvesJson" TEXT NOT NULL DEFAULT '[]',
  "requiresJson" TEXT NOT NULL DEFAULT '[]',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "sourceFindingIdsJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseActionNode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CaseActionNode_caseId_status_priority_idx" ON "CaseActionNode"("caseId", "status", "priority");
CREATE INDEX IF NOT EXISTS "CaseActionNode_caseId_actionKey_idx" ON "CaseActionNode"("caseId", "actionKey");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CaseActionNode_caseId_fkey') THEN
    ALTER TABLE "CaseActionNode" ADD CONSTRAINT "CaseActionNode_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
