-- Fix divergences:
-- - account_meta__individual: add `details` + `roleId`
-- - account_meta__brand: drop `dateCreated`, add `details`

BEGIN;

ALTER TABLE IF EXISTS account_meta__individual
  ADD COLUMN IF NOT EXISTS details jsonb,
  ADD COLUMN IF NOT EXISTS "roleId" text;

ALTER TABLE IF EXISTS account_meta__brand
  DROP COLUMN IF EXISTS "dateCreated",
  ADD COLUMN IF NOT EXISTS details jsonb;

COMMIT;

