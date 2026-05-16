-- AlterTable: add status column to application_connection
ALTER TABLE "application_connection" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
