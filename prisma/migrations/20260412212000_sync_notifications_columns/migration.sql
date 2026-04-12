-- Ensure notifications table has all columns required by Prisma model.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "action" TEXT,
  "title" TEXT,
  "message" TEXT,
  "type" TEXT NOT NULL DEFAULT 'info',
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletableOn" TIMESTAMP(3),
  "persistence" TEXT,
  "requestId" TEXT,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "action" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read" BOOLEAN;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deletableOn" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "persistence" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "requestId" TEXT;

UPDATE "notifications" SET "type" = 'info' WHERE "type" IS NULL;
UPDATE "notifications" SET "read" = false WHERE "read" IS NULL;
UPDATE "notifications" SET "createdAt" = CURRENT_TIMESTAMP WHERE "createdAt" IS NULL;

ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'info';
ALTER TABLE "notifications" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "read" SET DEFAULT false;
ALTER TABLE "notifications" ALTER COLUMN "read" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "notifications" ALTER COLUMN "createdAt" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'notifications'
      AND constraint_name = 'notifications_accountId_fkey'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'notifications'
      AND constraint_name = 'notifications_requestId_fkey'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_requestId_fkey"
      FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
