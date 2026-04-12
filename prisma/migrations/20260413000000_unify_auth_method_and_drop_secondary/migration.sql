DO $$
BEGIN
  IF to_regclass('public.auth_method') IS NULL AND to_regclass('public.auth_default') IS NOT NULL THEN
    ALTER TABLE "auth_default" RENAME TO "auth_method";
  END IF;
END $$;

ALTER TABLE "auth_method"
  ADD COLUMN IF NOT EXISTS "id" TEXT,
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "order" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "detail" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_method'
      AND column_name = 'defaultMethod'
  ) THEN
    UPDATE "auth_method"
    SET "type" = COALESCE("type", "defaultMethod");
  END IF;
END $$;

UPDATE "auth_method"
SET
  "id" = COALESCE(NULLIF("id", ''), 'password:' || "accountId"),
  "type" = COALESCE(NULLIF("type", ''), 'password'),
  "order" = COALESCE(NULLIF("order", ''), 'primary'),
  "status" = COALESCE(NULLIF("status", ''), 'active');

ALTER TABLE "auth_method"
  ALTER COLUMN "id" SET NOT NULL,
  ALTER COLUMN "accountId" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "value" SET NOT NULL,
  ALTER COLUMN "order" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'p'
      AND rel.relname = 'auth_method'
      AND nsp.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE "auth_method" DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE "auth_method"
  ADD CONSTRAINT "auth_method_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX IF NOT EXISTS "auth_method_accountId_type_order_key"
  ON "auth_method"("accountId", "type", "order");

CREATE INDEX IF NOT EXISTS "auth_method_accountId_idx"
  ON "auth_method"("accountId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_method'
      AND column_name = 'defaultMethod'
  ) THEN
    ALTER TABLE "auth_method" DROP COLUMN "defaultMethod";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.auth_secondary') IS NOT NULL THEN
    INSERT INTO "auth_method" ("id", "accountId", "type", "value", "order", "status", "detail")
    SELECT
      'totp:' || s."accountId",
      s."accountId",
      'totpToken',
      s."value",
      'secondary',
      'active',
      NULL
    FROM "auth_secondary" s
    WHERE s."kind" ILIKE '%totp%'
    ON CONFLICT ("accountId", "type", "order") DO UPDATE
      SET "value" = EXCLUDED."value",
          "status" = 'active';

    INSERT INTO "auth_method" ("id", "accountId", "type", "value", "order", "status", "detail")
    SELECT
      'backup:' || s."accountId",
      s."accountId",
      'backupCodes',
      'backupCodes',
      'backup',
      'active',
      jsonb_build_object(
        'codes',
        jsonb_agg(
          jsonb_build_object(
            'code', s."value",
            'status', CASE WHEN s."used" THEN 'used' ELSE 'active' END
          )
          ORDER BY s."createdAt" DESC
        )
      )
    FROM "auth_secondary" s
    WHERE s."kind" = 'backup_code'
    GROUP BY s."accountId"
    ON CONFLICT ("accountId", "type", "order") DO UPDATE
      SET "value" = EXCLUDED."value",
          "status" = 'active',
          "detail" = EXCLUDED."detail";

    DROP TABLE "auth_secondary";
  END IF;
END $$;
