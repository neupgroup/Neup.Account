-- Drop developer column from application table
ALTER TABLE "application"
DROP COLUMN IF EXISTS "developer";
