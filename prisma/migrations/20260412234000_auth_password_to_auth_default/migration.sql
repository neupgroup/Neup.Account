DO $$
BEGIN
  IF to_regclass('public.auth_default') IS NULL AND to_regclass('public.auth_password') IS NOT NULL THEN
    ALTER TABLE "auth_password" RENAME TO "auth_default";
  END IF;
END $$;

ALTER TABLE "auth_default"
  ADD COLUMN IF NOT EXISTS "defaultMethod" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_default'
      AND column_name = 'hash'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_default'
      AND column_name = 'value'
  ) THEN
    ALTER TABLE "auth_default" RENAME COLUMN "hash" TO "value";
  END IF;
END $$;

ALTER TABLE "auth_default"
  ADD COLUMN IF NOT EXISTS "value" TEXT;

UPDATE "auth_default"
SET "defaultMethod" = COALESCE("defaultMethod", 'password');

ALTER TABLE "auth_default"
  ALTER COLUMN "defaultMethod" SET DEFAULT 'password';

ALTER TABLE "auth_default"
  ALTER COLUMN "defaultMethod" SET NOT NULL;

ALTER TABLE "auth_default"
  ALTER COLUMN "value" SET NOT NULL;

ALTER TABLE "auth_default"
  DROP COLUMN IF EXISTS "passwordLastChanged";
