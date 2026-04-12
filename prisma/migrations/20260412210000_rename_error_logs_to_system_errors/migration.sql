DO $$
BEGIN
  IF to_regclass('public.system_errors') IS NULL AND to_regclass('public.error_logs') IS NOT NULL THEN
    ALTER TABLE "error_logs" RENAME TO "system_errors";
  END IF;
END $$;
