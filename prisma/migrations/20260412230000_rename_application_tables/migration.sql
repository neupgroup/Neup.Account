DO $$
BEGIN
  IF to_regclass('public.application') IS NULL AND to_regclass('public.applications') IS NOT NULL THEN
    ALTER TABLE "applications" RENAME TO "application";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.application_connection') IS NULL AND to_regclass('public.user_app_connections') IS NOT NULL THEN
    ALTER TABLE "user_app_connections" RENAME TO "application_connection";
  END IF;
END $$;
