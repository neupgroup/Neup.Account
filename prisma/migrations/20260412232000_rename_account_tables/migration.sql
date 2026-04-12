DO $$
BEGIN
  IF to_regclass('public.account') IS NULL AND to_regclass('public.accounts') IS NOT NULL THEN
    ALTER TABLE "accounts" RENAME TO "account";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.account_meta__brand') IS NULL AND to_regclass('public.account_type__brand') IS NOT NULL THEN
    ALTER TABLE "account_type__brand" RENAME TO "account_meta__brand";
  END IF;
END $$;

-- Requested name for individual table remains unchanged: account_type__individual.
