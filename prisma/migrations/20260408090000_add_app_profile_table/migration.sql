CREATE TABLE IF NOT EXISTS "app_profiles" (
  "key" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_profiles_pkey" PRIMARY KEY ("key")
);
