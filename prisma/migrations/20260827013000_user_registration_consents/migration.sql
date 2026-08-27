CREATE TABLE IF NOT EXISTS "UserConsent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "agreementVersion" TEXT NOT NULL,
  "receiptId" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT NOT NULL DEFAULT '',
  "context" TEXT NOT NULL DEFAULT 'registration',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserConsent_userId_key_idx" ON "UserConsent"("userId", "key");
CREATE INDEX IF NOT EXISTS "UserConsent_receiptId_idx" ON "UserConsent"("receiptId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserConsent_userId_fkey') THEN
    ALTER TABLE "UserConsent" ADD CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
