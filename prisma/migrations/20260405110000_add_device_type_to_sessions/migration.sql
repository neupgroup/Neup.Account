-- Align sessions table with Prisma schema: add optional deviceType column
ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "deviceType" TEXT;
