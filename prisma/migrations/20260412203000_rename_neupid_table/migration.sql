DO $$
BEGIN
  IF to_regclass('public.neupid') IS NULL THEN
    IF to_regclass('public.account_neupid') IS NOT NULL THEN
      ALTER TABLE "account_neupid" RENAME TO "neupid";
    ELSIF to_regclass('public.neup_ids') IS NOT NULL THEN
      ALTER TABLE "neup_ids" RENAME TO "neupid";
    END IF;
  END IF;
END $$;
