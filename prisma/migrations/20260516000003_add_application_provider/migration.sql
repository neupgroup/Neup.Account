-- CreateTable
CREATE TABLE "application_provider" (
    "id" TEXT NOT NULL,
    "provider_name" TEXT NOT NULL,
    "provider_site" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,

    CONSTRAINT "application_provider_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "application" ADD COLUMN "provider_id" TEXT;

-- AddForeignKey
ALTER TABLE "application" ADD CONSTRAINT "application_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "application_provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
