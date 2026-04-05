ALTER TABLE "applications"
ADD COLUMN IF NOT EXISTS "access" JSONB,
ADD COLUMN IF NOT EXISTS "policies" JSONB,
ADD COLUMN IF NOT EXISTS "endpoints" JSONB,
ADD COLUMN IF NOT EXISTS "ownerAccountId" TEXT;

ALTER TABLE "applications"
ADD CONSTRAINT "applications_ownerAccountId_fkey"
FOREIGN KEY ("ownerAccountId") REFERENCES "accounts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
