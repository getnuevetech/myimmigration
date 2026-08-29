-- Phase −1: persist conversation intelligence snapshots
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "intelligenceJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "QaThread" ADD COLUMN IF NOT EXISTS "intelligenceJson" TEXT NOT NULL DEFAULT '{}';
