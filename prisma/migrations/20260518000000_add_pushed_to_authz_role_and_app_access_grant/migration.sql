-- Add pushed flags used to track whether authz data has been pushed/synced to external applications.

ALTER TABLE "authz_role"
ADD COLUMN IF NOT EXISTS "pushed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "authz_app_access_grant"
ADD COLUMN IF NOT EXISTS "pushed" BOOLEAN NOT NULL DEFAULT false;

