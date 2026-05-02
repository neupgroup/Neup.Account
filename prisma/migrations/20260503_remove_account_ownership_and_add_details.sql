-- Migration: Remove account_ownership table, drop dateCreated from brand meta, add details jsonb to meta tables

-- Drop the account_ownership table if it exists
DROP TABLE IF EXISTS account_ownership CASCADE;

-- Remove dateCreated column from account_meta__brand if present
ALTER TABLE IF EXISTS account_meta__brand
  DROP COLUMN IF EXISTS "dateCreated";

-- Add details column (jsonb) to account_meta__individual if missing
ALTER TABLE IF EXISTS account_meta__individual
  ADD COLUMN IF NOT EXISTS details jsonb;

-- Add details column (jsonb) to account_meta__brand if missing
ALTER TABLE IF EXISTS account_meta__brand
  ADD COLUMN IF NOT EXISTS details jsonb;

-- Optional: set defaults or backfill as needed. Example to set empty JSON object where NULL:
-- UPDATE account_meta__individual SET details = '{}'::jsonb WHERE details IS NULL;
-- UPDATE account_meta__brand SET details = '{}'::jsonb WHERE details IS NULL;
