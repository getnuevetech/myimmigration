CREATE TABLE IF NOT EXISTS "GoalSuggestionStat" (
  "id" TEXT NOT NULL,
  "queryKey" TEXT NOT NULL,
  "actionKey" TEXT NOT NULL,
  "recommendedCount" INTEGER NOT NULL DEFAULT 0,
  "completedCount" INTEGER NOT NULL DEFAULT 0,
  "lastRecommendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCompletedAt" TIMESTAMP(3),
  CONSTRAINT "GoalSuggestionStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoalSuggestionStat_queryKey_actionKey_key" ON "GoalSuggestionStat"("queryKey", "actionKey");
CREATE INDEX IF NOT EXISTS "GoalSuggestionStat_queryKey_completedCount_idx" ON "GoalSuggestionStat"("queryKey", "completedCount");
