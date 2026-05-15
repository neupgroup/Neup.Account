-- AlterTable: add isPermanent and hasFullAccess columns to portfolio_member
ALTER TABLE "portfolio_member"
  ADD COLUMN "isPermanent"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hasFullAccess" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing details JSON
UPDATE "portfolio_member"
SET
  "isPermanent"   = COALESCE((details->>'isPermanent')::boolean,   false),
  "hasFullAccess" = COALESCE((details->>'hasFullAccess')::boolean, false)
WHERE details IS NOT NULL;
