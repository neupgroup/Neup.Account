DO $$
BEGIN
  IF to_regclass('public.auth_password') IS NULL THEN
    IF to_regclass('public.passwords') IS NOT NULL THEN
      ALTER TABLE "passwords" RENAME TO "auth_password";
    ELSIF to_regclass('public.auth_passwords') IS NOT NULL THEN
      ALTER TABLE "auth_passwords" RENAME TO "auth_password";
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "auth_secondary" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_secondary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_secondary_accountId_kind_idx"
  ON "auth_secondary"("accountId", "kind");

DO $$
BEGIN
  IF to_regclass('public.auth_secondary') IS NOT NULL AND to_regclass('public.backup_codes') IS NOT NULL THEN
    INSERT INTO "auth_secondary" ("id", "accountId", "kind", "value", "used", "createdAt")
    SELECT
      bc."id",
      bc."accountId",
      'backup_code',
      bc."code",
      bc."used",
      bc."createdAt"
    FROM "backup_codes" bc
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  IF to_regclass('public.auth_secondary') IS NOT NULL AND to_regclass('public.auth_totp') IS NOT NULL THEN
    INSERT INTO "auth_secondary" ("id", "accountId", "kind", "value", "used", "createdAt")
    SELECT
      at."accountId" || ':totp',
      at."accountId",
      'totp',
      at."secret",
      false,
      at."createdAt"
    FROM "auth_totp" at
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "auth_roles";
DROP TABLE IF EXISTS "auth_teams";
DROP TABLE IF EXISTS "auth_totp";
DROP TABLE IF EXISTS "backup_codes";
