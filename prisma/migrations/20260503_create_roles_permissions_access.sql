-- Migration: Create role, permission, role_calculated, and access tables

-- Permission table
CREATE TABLE IF NOT EXISTS permission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  isRoot boolean DEFAULT false
);

-- Role table
CREATE TABLE IF NOT EXISTS role (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "accountId" uuid NOT NULL,
  permissions text[] DEFAULT '{}',
  description text
);
ALTER TABLE IF EXISTS role
  ADD CONSTRAINT role_accountId_fkey FOREIGN KEY ("accountId") REFERENCES account(id) ON DELETE CASCADE;

-- Role Calculated table
CREATE TABLE IF NOT EXISTS role_calculated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "roleId" uuid NOT NULL,
  "permissionId" uuid NOT NULL,
  "hasRoot" boolean DEFAULT false
);
ALTER TABLE IF EXISTS role_calculated
  ADD CONSTRAINT role_calculated_roleId_fkey FOREIGN KEY ("roleId") REFERENCES role(id) ON DELETE CASCADE,
  ADD CONSTRAINT role_calculated_permissionId_fkey FOREIGN KEY ("permissionId") REFERENCES permission(id) ON DELETE CASCADE;

-- Access table
CREATE TABLE IF NOT EXISTS access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" uuid NOT NULL,
  "permissionId" uuid NOT NULL,
  "recipientId" uuid NOT NULL,
  "expiresAt" timestamp,
  status text DEFAULT 'active',
  "portfolioId" uuid
);
ALTER TABLE IF EXISTS access
  ADD CONSTRAINT access_accountId_fkey FOREIGN KEY ("accountId") REFERENCES account(id) ON DELETE CASCADE,
  ADD CONSTRAINT access_permissionId_fkey FOREIGN KEY ("permissionId") REFERENCES permission(id) ON DELETE CASCADE,
  ADD CONSTRAINT access_recipientId_fkey FOREIGN KEY ("recipientId") REFERENCES account(id) ON DELETE CASCADE,
  ADD CONSTRAINT access_portfolioId_fkey FOREIGN KEY ("portfolioId") REFERENCES portfolio(id) ON DELETE SET NULL;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_role_accountId ON role("accountId");
CREATE INDEX IF NOT EXISTS idx_role_calculated_roleId ON role_calculated("roleId");
CREATE INDEX IF NOT EXISTS idx_role_calculated_permissionId ON role_calculated("permissionId");
CREATE INDEX IF NOT EXISTS idx_access_accountId ON access("accountId");
CREATE INDEX IF NOT EXISTS idx_access_recipientId ON access("recipientId");
CREATE INDEX IF NOT EXISTS idx_access_permissionId ON access("permissionId");

-- Notes: backfill or adjust defaults as needed after creating tables.
