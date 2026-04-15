-- Drop application column from auth_session table
ALTER TABLE "auth_session"
  DROP COLUMN IF EXISTS "application";
