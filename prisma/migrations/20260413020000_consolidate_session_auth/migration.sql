-- Consolidate external/internal app auth into sessions table

ALTER TABLE "sessions"
	ADD COLUMN IF NOT EXISTS "application" TEXT,
	ADD COLUMN IF NOT EXISTS "applicationDomain" TEXT,
	ADD COLUMN IF NOT EXISTS "applicationType" TEXT,
	ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '[]';

UPDATE "sessions"
SET "applicationType" = 'internal'
WHERE "applicationType" IS NULL;

UPDATE "sessions"
SET "application" = 'neup.account'
WHERE "application" IS NULL;

ALTER TABLE "sessions"
	ALTER COLUMN "applicationType" SET DEFAULT 'internal',
	ALTER COLUMN "applicationType" SET NOT NULL;

DROP TABLE IF EXISTS "auth_permission_recipients" CASCADE;
DROP TABLE IF EXISTS "app_authentications" CASCADE;
DROP TABLE IF EXISTS "app_sessions" CASCADE;

