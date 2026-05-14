-- CreateTable: authz_app_access_grant
-- Purpose: Stores per-app role grants between accounts.
-- account_id is the owner (granting party), target_account_id is the grantee.
-- Scoped to an application and optionally a portfolio.

CREATE TABLE "authz_app_access_grant" (
    "id"                TEXT NOT NULL,
    "app_id"            TEXT NOT NULL,
    "account_id"        TEXT NOT NULL,
    "target_account_id" TEXT NOT NULL,
    "role_id"           TEXT NOT NULL,
    "portfolio_id"      TEXT,

    CONSTRAINT "authz_app_access_grant_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "authz_app_access_grant_app_id_idx"             ON "authz_app_access_grant"("app_id");
CREATE INDEX "authz_app_access_grant_account_id_idx"         ON "authz_app_access_grant"("account_id");
CREATE INDEX "authz_app_access_grant_target_account_id_idx"  ON "authz_app_access_grant"("target_account_id");
CREATE INDEX "authz_app_access_grant_role_id_idx"            ON "authz_app_access_grant"("role_id");
CREATE INDEX "authz_app_access_grant_portfolio_id_idx"       ON "authz_app_access_grant"("portfolio_id");

-- Foreign Keys
ALTER TABLE "authz_app_access_grant"
    ADD CONSTRAINT "authz_app_access_grant_app_id_fkey"
    FOREIGN KEY ("app_id") REFERENCES "application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authz_app_access_grant"
    ADD CONSTRAINT "authz_app_access_grant_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authz_app_access_grant"
    ADD CONSTRAINT "authz_app_access_grant_target_account_id_fkey"
    FOREIGN KEY ("target_account_id") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authz_app_access_grant"
    ADD CONSTRAINT "authz_app_access_grant_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "authz_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "authz_app_access_grant"
    ADD CONSTRAINT "authz_app_access_grant_portfolio_id_fkey"
    FOREIGN KEY ("portfolio_id") REFERENCES "portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
