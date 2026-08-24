CREATE TABLE IF NOT EXISTS "AuthoritySource" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'official',
  "publisher" TEXT NOT NULL DEFAULT 'USCIS',
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "authorityRank" TEXT NOT NULL DEFAULT 'high',
  "jurisdictionOrScope" TEXT NOT NULL DEFAULT '',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthoritySource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuthoritySnapshot" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "caseId" TEXT,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveOrUpdateDate" TEXT NOT NULL DEFAULT '',
  "contentHash" TEXT NOT NULL DEFAULT '',
  "excerpt" TEXT NOT NULL DEFAULT '',
  "applicabilityJson" TEXT NOT NULL DEFAULT '[]',
  CONSTRAINT "AuthoritySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthoritySource_key_key" ON "AuthoritySource"("key");
CREATE INDEX IF NOT EXISTS "AuthoritySnapshot_sourceId_retrievedAt_idx" ON "AuthoritySnapshot"("sourceId", "retrievedAt");
CREATE INDEX IF NOT EXISTS "AuthoritySnapshot_caseId_retrievedAt_idx" ON "AuthoritySnapshot"("caseId", "retrievedAt");
CREATE INDEX IF NOT EXISTS "AuthoritySnapshot_contentHash_idx" ON "AuthoritySnapshot"("contentHash");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuthoritySnapshot_sourceId_fkey') THEN
    ALTER TABLE "AuthoritySnapshot" ADD CONSTRAINT "AuthoritySnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AuthoritySource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuthoritySnapshot_caseId_fkey') THEN
    ALTER TABLE "AuthoritySnapshot" ADD CONSTRAINT "AuthoritySnapshot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
