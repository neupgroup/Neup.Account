-- Rename expiresOn to validTill in auth_session table
ALTER TABLE "auth_session"
  RENAME COLUMN "expiresOn" TO "validTill";

-- Drop isExpired column if it exists
ALTER TABLE "auth_session"
  DROP COLUMN IF EXISTS "isExpired";
