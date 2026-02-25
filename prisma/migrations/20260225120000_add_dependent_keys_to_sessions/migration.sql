-- AlterTable: add missing dependentKeys column to sessions to match Prisma schema
ALTER TABLE "sessions" 
ADD COLUMN IF NOT EXISTS "dependentKeys" JSONB DEFAULT '[]'::jsonb;

