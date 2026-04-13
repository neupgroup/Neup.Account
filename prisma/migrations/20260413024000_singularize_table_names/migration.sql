-- Rename selected plural tables to singular format

DO $$ BEGIN
  IF to_regclass('public.auth_requests') IS NOT NULL AND to_regclass('public.auth_request') IS NULL THEN
    ALTER TABLE "auth_requests" RENAME TO "auth_request";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL AND to_regclass('public.notification') IS NULL THEN
    ALTER TABLE "notifications" RENAME TO "notification";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.requests') IS NOT NULL AND to_regclass('public.request') IS NULL THEN
    ALTER TABLE "requests" RENAME TO "request";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.verifications') IS NOT NULL AND to_regclass('public.verification') IS NULL THEN
    ALTER TABLE "verifications" RENAME TO "verification";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.contacts') IS NOT NULL AND to_regclass('public.contact') IS NULL THEN
    ALTER TABLE "contacts" RENAME TO "contact";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.permits') IS NOT NULL AND to_regclass('public.permit') IS NULL THEN
    ALTER TABLE "permits" RENAME TO "permit";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.system_errors') IS NOT NULL AND to_regclass('public.system_error') IS NULL THEN
    ALTER TABLE "system_errors" RENAME TO "system_error";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.portfolio_assets') IS NOT NULL AND to_regclass('public.portfolio_asset') IS NULL THEN
    ALTER TABLE "portfolio_assets" RENAME TO "portfolio_asset";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.portfolio_members') IS NOT NULL AND to_regclass('public.portfolio_member') IS NULL THEN
    ALTER TABLE "portfolio_members" RENAME TO "portfolio_member";
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.sessions') IS NOT NULL AND to_regclass('public.auth_session') IS NULL THEN
    ALTER TABLE "sessions" RENAME TO "auth_session";
  END IF;
END $$;
