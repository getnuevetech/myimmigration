-- Phase F: logical analysis ownership for orchestration reliability
CREATE TABLE "LogicalAnalysis" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseVersionId" TEXT,
    "parentId" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'user_request',
    "status" TEXT NOT NULL DEFAULT 'running',
    "skipReason" TEXT NOT NULL DEFAULT '',
    "modelCallCount" INTEGER NOT NULL DEFAULT 0,
    "failedCallCount" INTEGER NOT NULL DEFAULT 0,
    "stageBudgetJson" TEXT NOT NULL DEFAULT '{}',
    "coalescePending" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "wallClockMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LogicalAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LogicalAnalysis_caseId_status_idx" ON "LogicalAnalysis"("caseId", "status");
CREATE INDEX "LogicalAnalysis_caseId_startedAt_idx" ON "LogicalAnalysis"("caseId", "startedAt");
CREATE INDEX "LogicalAnalysis_parentId_idx" ON "LogicalAnalysis"("parentId");

ALTER TABLE "LogicalAnalysis" ADD CONSTRAINT "LogicalAnalysis_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogicalAnalysis" ADD CONSTRAINT "LogicalAnalysis_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LogicalAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalysisRun" ADD COLUMN "logicalAnalysisId" TEXT;
CREATE INDEX "AnalysisRun_logicalAnalysisId_idx" ON "AnalysisRun"("logicalAnalysisId");
CREATE INDEX "AnalysisRun_caseId_startedAt_idx" ON "AnalysisRun"("caseId", "startedAt");
ALTER TABLE "AnalysisRun" ADD CONSTRAINT "AnalysisRun_logicalAnalysisId_fkey" FOREIGN KEY ("logicalAnalysisId") REFERENCES "LogicalAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
