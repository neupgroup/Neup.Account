DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'app_profiles'
  ) THEN
    ALTER TABLE "app_profiles" RENAME TO "system_config";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_profiles_pkey'
  ) THEN
    ALTER TABLE "system_config" RENAME CONSTRAINT "app_profiles_pkey" TO "system_config_pkey";
  END IF;
END $$;
