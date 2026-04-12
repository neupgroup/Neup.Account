-- Keep only base account fields:
-- id, accountType, displayImage, displayName, status, isVerified, createdAt, details

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

UPDATE "accounts"
SET
  "displayImage" = COALESCE("displayImage", "accountPhoto"),
  "displayName" = COALESCE("displayName", "nameDisplay"),
  "status" = COALESCE("status", "accountStatus"),
  "isVerified" = COALESCE("isVerified", "verified", false),
  "createdAt" = COALESCE("createdAt", "dateCreated", CURRENT_TIMESTAMP),
  "details" = COALESCE("details", "block")
WHERE
  "displayImage" IS NULL
  OR "displayName" IS NULL
  OR "status" IS NULL
  OR "isVerified" IS NULL
  OR "createdAt" IS NULL
  OR "details" IS NULL;

ALTER TABLE "accounts" ALTER COLUMN "isVerified" SET NOT NULL;
ALTER TABLE "accounts" ALTER COLUMN "isVerified" SET DEFAULT false;
ALTER TABLE "accounts" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "accounts" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nameFirst";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nameMiddle";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nameLast";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nameDisplay";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "accountPhoto";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "gender";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "dateBirth";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "dateCreated";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nationality";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "isLegalEntity";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "nameLegal";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "registrationId";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "countryOfOrigin";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "dateEstablished";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "neupIdPrimary";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "verified";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "pro";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "permit";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "accountStatus";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "parentBrandId";
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "block";
