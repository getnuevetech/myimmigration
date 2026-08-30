-- Phase −1.9 L7 — experience pattern telemetry + stale/authority invalidation
ALTER TABLE "ExperienceObservation" ADD COLUMN IF NOT EXISTS "staleAt" TIMESTAMP(3);
ALTER TABLE "ExperienceObservation" ADD COLUMN IF NOT EXISTS "staleReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ExperienceObservation" ADD COLUMN IF NOT EXISTS "helpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExperienceObservation" ADD COLUMN IF NOT EXISTS "harmCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExperienceObservation" ADD COLUMN IF NOT EXISTS "lastServedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ExperienceObservation_promotionLevel_staleAt_idx" ON "ExperienceObservation"("promotionLevel", "staleAt");
