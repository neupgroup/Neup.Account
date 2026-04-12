DO $$
BEGIN
  IF to_regclass('public.account_meta__individual') IS NULL
     AND to_regclass('public.account_type__individual') IS NOT NULL THEN
    ALTER TABLE "account_type__individual" RENAME TO "account_meta__individual";
  END IF;
END $$;
