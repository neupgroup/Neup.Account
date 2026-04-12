-- Normalize account domain into base account + typed profile + ownership tables.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "displayImage" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "status" TEXT;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT false;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "details" JSONB;

UPDATE "accounts"
SET
  "displayImage" = COALESCE("displayImage", "accountPhoto"),
  "status" = COALESCE("status", "accountStatus"),
  "isVerified" = COALESCE("isVerified", "verified", false)
WHERE
  "displayImage" IS NULL
  OR "status" IS NULL
  OR "isVerified" IS NULL;

CREATE TABLE IF NOT EXISTS "account_type__individual" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "firstName" TEXT,
  "middleName" TEXT,
  "lastName" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "countryOfResidence" TEXT,
  CONSTRAINT "account_type__individual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_type__individual_accountId_key" UNIQUE ("accountId")
);

CREATE TABLE IF NOT EXISTS "account_type__brand" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "brandName" TEXT,
  "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isLegalEntity" BOOLEAN NOT NULL DEFAULT false,
  "originCountry" TEXT,
  CONSTRAINT "account_type__brand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_type__brand_accountId_key" UNIQUE ("accountId")
);

CREATE TABLE IF NOT EXISTS "account_ownership" (
  "id" TEXT NOT NULL,
  "parentId" TEXT NOT NULL,
  "childrenId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  CONSTRAINT "account_ownership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_ownership_parentId_childrenId_type_key"
  ON "account_ownership"("parentId", "childrenId", "type");
CREATE INDEX IF NOT EXISTS "account_ownership_parentId_idx"
  ON "account_ownership"("parentId");
CREATE INDEX IF NOT EXISTS "account_ownership_childrenId_idx"
  ON "account_ownership"("childrenId");

ALTER TABLE "account_type__individual"
  DROP CONSTRAINT IF EXISTS "account_type__individual_accountId_fkey",
  ADD CONSTRAINT "account_type__individual_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_type__brand"
  DROP CONSTRAINT IF EXISTS "account_type__brand_accountId_fkey",
  ADD CONSTRAINT "account_type__brand_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_ownership"
  DROP CONSTRAINT IF EXISTS "account_ownership_parentId_fkey",
  ADD CONSTRAINT "account_ownership_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_ownership"
  DROP CONSTRAINT IF EXISTS "account_ownership_childrenId_fkey",
  ADD CONSTRAINT "account_ownership_childrenId_fkey"
  FOREIGN KEY ("childrenId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "account_type__individual" ("id", "accountId", "firstName", "middleName", "lastName", "dateOfBirth", "countryOfResidence")
SELECT
  gen_random_uuid()::text,
  a."id",
  a."nameFirst",
  a."nameMiddle",
  a."nameLast",
  a."dateBirth",
  a."nationality"
FROM "accounts" a
WHERE a."accountType" IN ('individual', 'dependent')
ON CONFLICT ("accountId") DO NOTHING;

INSERT INTO "account_type__brand" ("id", "accountId", "brandName", "dateCreated", "isLegalEntity", "originCountry")
SELECT
  gen_random_uuid()::text,
  a."id",
  COALESCE(a."nameDisplay", a."displayName"),
  COALESCE(a."dateCreated", CURRENT_TIMESTAMP),
  COALESCE(a."isLegalEntity", false),
  a."countryOfOrigin"
FROM "accounts" a
WHERE a."accountType" IN ('brand', 'branch')
ON CONFLICT ("accountId") DO NOTHING;

INSERT INTO "account_ownership" ("id", "parentId", "childrenId", "type")
SELECT
  gen_random_uuid()::text,
  a."parentBrandId",
  a."id",
  'branch'
FROM "accounts" a
WHERE a."parentBrandId" IS NOT NULL
ON CONFLICT ("parentId", "childrenId", "type") DO NOTHING;

INSERT INTO "account_ownership" ("id", "parentId", "childrenId", "type")
SELECT
  gen_random_uuid()::text,
  p."accountId",
  p."targetAccountId",
  CASE
    WHEN ta."accountType" = 'brand' THEN 'brand'
    WHEN ta."accountType" = 'dependent' THEN 'dependent'
    ELSE 'child'
  END
FROM "permits" p
JOIN "accounts" ta ON ta."id" = p."targetAccountId"
WHERE p."forSelf" = false
  AND p."targetAccountId" IS NOT NULL
  AND ta."accountType" IN ('brand', 'dependent')
ON CONFLICT ("parentId", "childrenId", "type") DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.account_neupid') IS NULL AND to_regclass('public.neup_ids') IS NOT NULL THEN
    ALTER TABLE "neup_ids" RENAME TO "account_neupid";
  END IF;
END $$;

ALTER TABLE "account_neupid" ADD COLUMN IF NOT EXISTS "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
