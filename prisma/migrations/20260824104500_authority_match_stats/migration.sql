CREATE TABLE IF NOT EXISTS "AuthorityMatchStat" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "queryKey" TEXT NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthorityMatchStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorityMatchStat_sourceId_queryKey_key" ON "AuthorityMatchStat"("sourceId", "queryKey");
CREATE INDEX IF NOT EXISTS "AuthorityMatchStat_queryKey_hitCount_idx" ON "AuthorityMatchStat"("queryKey", "hitCount");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuthorityMatchStat_sourceId_fkey') THEN
    ALTER TABLE "AuthorityMatchStat" ADD CONSTRAINT "AuthorityMatchStat_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AuthoritySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
