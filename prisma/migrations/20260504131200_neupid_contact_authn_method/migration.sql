-- Fix divergences:
-- - neupid: add `neupId` column + UNIQUE, and ensure `id` has a UUID default
-- - contact: ensure `id` has a UUID default
-- - auth_method: rename to `authn_method` and ensure `id` has a UUID default

BEGIN;

-- neupid
ALTER TABLE IF EXISTS neupid
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

ALTER TABLE IF EXISTS neupid
  ADD COLUMN IF NOT EXISTS "neupId" text;

UPDATE neupid
SET "neupId" = id
WHERE "neupId" IS NULL;

ALTER TABLE IF EXISTS neupid
  ALTER COLUMN "neupId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS neupid_neupId_key ON neupid("neupId");

-- contact
ALTER TABLE IF EXISTS contact
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

-- auth_method -> authn_method (expected)
DO $$
BEGIN
  IF to_regclass('public.auth_method') IS NOT NULL AND to_regclass('public.authn_method') IS NULL THEN
    EXECUTE 'ALTER TABLE auth_method RENAME TO authn_method';
  END IF;
END $$;

ALTER TABLE IF EXISTS authn_method
  ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);

COMMIT;

