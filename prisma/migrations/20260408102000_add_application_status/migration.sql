ALTER TABLE "applications"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'development';
