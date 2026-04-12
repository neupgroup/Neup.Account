-- Create new portfolio tables
CREATE TABLE IF NOT EXISTS "portfolio" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "portfolio_assets" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "assetType" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "details" JSONB,
  CONSTRAINT "portfolio_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "portfolio_members" (
  "id" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "details" JSONB,
  CONSTRAINT "portfolio_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "portfolio_role" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "details" JSONB,
  CONSTRAINT "portfolio_role_pkey" PRIMARY KEY ("id")
);

-- Constraints and indexes for new tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_assets_portfolioId_fkey'
  ) THEN
    ALTER TABLE "portfolio_assets"
      ADD CONSTRAINT "portfolio_assets_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_members_portfolioId_fkey'
  ) THEN
    ALTER TABLE "portfolio_members"
      ADD CONSTRAINT "portfolio_members_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_members_accountId_fkey'
  ) THEN
    ALTER TABLE "portfolio_members"
      ADD CONSTRAINT "portfolio_members_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_role_accountId_fkey'
  ) THEN
    ALTER TABLE "portfolio_role"
      ADD CONSTRAINT "portfolio_role_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_role_portfolioId_fkey'
  ) THEN
    ALTER TABLE "portfolio_role"
      ADD CONSTRAINT "portfolio_role_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "portfolio_assets_portfolioId_idx" ON "portfolio_assets"("portfolioId");
CREATE INDEX IF NOT EXISTS "portfolio_assets_assetType_assetId_idx" ON "portfolio_assets"("assetType", "assetId");
CREATE INDEX IF NOT EXISTS "portfolio_members_portfolioId_idx" ON "portfolio_members"("portfolioId");
CREATE INDEX IF NOT EXISTS "portfolio_members_accountId_idx" ON "portfolio_members"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_members_portfolioId_accountId_key" ON "portfolio_members"("portfolioId", "accountId");
CREATE INDEX IF NOT EXISTS "portfolio_role_accountId_idx" ON "portfolio_role"("accountId");
CREATE INDEX IF NOT EXISTS "portfolio_role_portfolioId_idx" ON "portfolio_role"("portfolioId");
CREATE INDEX IF NOT EXISTS "portfolio_role_roleId_idx" ON "portfolio_role"("roleId");
CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_role_accountId_portfolioId_roleId_key" ON "portfolio_role"("accountId", "portfolioId", "roleId");

-- Move data from legacy asset-group structure if present
DO $$
BEGIN
  IF to_regclass('public."assetGroupInfo"') IS NOT NULL THEN
    INSERT INTO "portfolio" ("id", "name", "description", "dateCreated")
    SELECT a."id", a."name", a."details", CURRENT_TIMESTAMP
    FROM "assetGroupInfo" a
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.asset') IS NOT NULL THEN
    INSERT INTO "portfolio_assets" ("id", "portfolioId", "assetType", "assetId", "details")
    SELECT
      a."id",
      a."assetGroup",
      a."type",
      a."asset",
      CASE
        WHEN a."details" IS NULL THEN NULL
        ELSE jsonb_build_object('note', a."details")
      END
    FROM "asset" a
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."assetGroupMember"') IS NOT NULL THEN
    INSERT INTO "portfolio_members" ("id", "portfolioId", "accountId", "details")
    SELECT
      m."id",
      m."assetGroup",
      REPLACE(m."member", 'account:', ''),
      jsonb_build_object(
        'isPermanent', m."isPermanent",
        'removesOn', m."validTill",
        'hasFullAccess', m."hasFullPermit"
      )
    FROM "assetGroupMember" m
    WHERE m."member" LIKE 'account:%'
    ON CONFLICT ("portfolioId", "accountId") DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."assetMemberRole"') IS NOT NULL
     AND to_regclass('public."assetGroupMember"') IS NOT NULL THEN
    INSERT INTO "portfolio_role" ("id", "accountId", "portfolioId", "roleId", "details")
    SELECT
      amr."id",
      REPLACE(agm."member", 'account:', ''),
      agm."assetGroup",
      amr."role",
      jsonb_build_object('source', 'assetMemberRole')
    FROM "assetMemberRole" amr
    JOIN "assetGroupMember" agm ON agm."id" = amr."assetMember"
    WHERE agm."member" LIKE 'account:%'
    ON CONFLICT ("accountId", "portfolioId", "roleId") DO NOTHING;
  END IF;
END $$;

-- Drop legacy tables
DROP TABLE IF EXISTS "assetMemberRole";
DROP TABLE IF EXISTS "asset";
DROP TABLE IF EXISTS "assetGroupMember";
DROP TABLE IF EXISTS "assetGroupInfo";
DROP TABLE IF EXISTS "auth_teams_external";
