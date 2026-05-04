-- Fix divergence: `account.id` has no DEFAULT in live DB; expected default `uuid()`.
BEGIN;
ALTER TABLE IF EXISTS account ALTER COLUMN id SET DEFAULT (gen_random_uuid()::text);
COMMIT;

