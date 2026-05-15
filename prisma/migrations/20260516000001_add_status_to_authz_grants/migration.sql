-- CreateEnum: AuthzGrantStatus
-- Adds a status field to authz_account_access_grant and authz_app_access_grant.
-- Values: active (default), invited, on_hold, expired.

CREATE TYPE "AuthzGrantStatus" AS ENUM ('active', 'invited', 'on_hold', 'expired');

-- AlterTable: authz_account_access_grant — add status column
ALTER TABLE "authz_account_access_grant"
    ADD COLUMN "status" "AuthzGrantStatus" NOT NULL DEFAULT 'active';

CREATE INDEX "authz_account_access_grant_status_idx"
    ON "authz_account_access_grant"("status");

-- AlterTable: authz_app_access_grant — add status column
ALTER TABLE "authz_app_access_grant"
    ADD COLUMN "status" "AuthzGrantStatus" NOT NULL DEFAULT 'active';

CREATE INDEX "authz_app_access_grant_status_idx"
    ON "authz_app_access_grant"("status");
