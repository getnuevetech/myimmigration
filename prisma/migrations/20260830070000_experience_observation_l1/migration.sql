-- Phase −1.9 L1: de-identified ExperienceObservation store
CREATE TABLE IF NOT EXISTS "ExperienceObservation" (
    "id" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "decisionTarget" TEXT NOT NULL DEFAULT '',
    "workspace" TEXT NOT NULL DEFAULT '',
    "promotionLevel" INTEGER NOT NULL DEFAULT 0,
    "anonJson" TEXT NOT NULL DEFAULT '{}',
    "sourceSituationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExperienceObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExperienceObservation_decisionTarget_promotionLevel_idx"
  ON "ExperienceObservation"("decisionTarget", "promotionLevel");
CREATE INDEX IF NOT EXISTS "ExperienceObservation_sourceDigest_idx"
  ON "ExperienceObservation"("sourceDigest");
CREATE INDEX IF NOT EXISTS "ExperienceObservation_sourceSituationId_idx"
  ON "ExperienceObservation"("sourceSituationId");

DO $$ BEGIN
  ALTER TABLE "ExperienceObservation"
    ADD CONSTRAINT "ExperienceObservation_sourceSituationId_fkey"
    FOREIGN KEY ("sourceSituationId") REFERENCES "Situation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
