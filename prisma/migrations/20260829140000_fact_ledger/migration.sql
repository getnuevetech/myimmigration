-- Phase B: fact ledger persistence + stale customer output flag
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "customerOutputStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "invalidationPendingAt" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "invalidationReason" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CaseReconstruction" ADD COLUMN IF NOT EXISTS "factLedgerJson" TEXT NOT NULL DEFAULT '{}';
