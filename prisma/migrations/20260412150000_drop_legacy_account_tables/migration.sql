DO $$
BEGIN
  IF to_regclass('public.recovery_contacts') IS NOT NULL THEN
    INSERT INTO "contacts" ("id", "accountId", "contactType", "value")
    SELECT rc."id", rc."ownerAccountId", 'recoveryAccount', rc."recoveryAccountId"
    FROM "recovery_contacts" rc
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  IF to_regclass('public.kyc_requests') IS NOT NULL THEN
    INSERT INTO "activity_logs" (
      "id",
      "targetAccountId",
      "actorAccountId",
      "action",
      "status",
      "ip",
      "timestamp",
      "geolocation"
    )
    SELECT
      kr."id",
      kr."accountId",
      kr."accountId",
      'KYC Request: ' || COALESCE(kr."documentType", 'unknown'),
      CASE
        WHEN LOWER(COALESCE(kr."status", 'pending')) = 'approved' THEN 'Success'
        WHEN LOWER(COALESCE(kr."status", 'pending')) = 'rejected' THEN 'Failed'
        ELSE 'Pending'
      END,
      'migrated',
      COALESCE(kr."submittedAt", NOW()),
      NULL
    FROM "kyc_requests" kr
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  IF to_regclass('public.invitations') IS NOT NULL THEN
    INSERT INTO "activity_logs" (
      "id",
      "targetAccountId",
      "actorAccountId",
      "action",
      "status",
      "ip",
      "timestamp",
      "geolocation"
    )
    SELECT
      i."id",
      i."inviterAccountId",
      i."inviterAccountId",
      'Invitation Sent To: ' || COALESCE(i."inviteeEmail", 'unknown'),
      CASE
        WHEN LOWER(COALESCE(i."status", 'pending')) IN ('accepted', 'approved') THEN 'Success'
        WHEN LOWER(COALESCE(i."status", 'pending')) IN ('rejected', 'declined', 'expired') THEN 'Failed'
        ELSE 'Pending'
      END,
      'migrated',
      COALESCE(i."createdAt", NOW()),
      NULL
    FROM "invitations" i
    ON CONFLICT ("id") DO NOTHING;
  END IF;

  IF to_regclass('public.neupid_requests') IS NOT NULL THEN
    INSERT INTO "activity_logs" (
      "id",
      "targetAccountId",
      "actorAccountId",
      "action",
      "status",
      "ip",
      "timestamp",
      "geolocation"
    )
    SELECT
      nr."id",
      nr."accountId",
      nr."accountId",
      'NeupID Request: ' || COALESCE(nr."requestedId", 'unknown'),
      CASE
        WHEN LOWER(COALESCE(nr."status", 'pending')) = 'approved' THEN 'Success'
        WHEN LOWER(COALESCE(nr."status", 'pending')) IN ('rejected', 'denied') THEN 'Failed'
        ELSE 'Pending'
      END,
      'migrated',
      COALESCE(nr."submittedAt", NOW()),
      NULL
    FROM "neupid_requests" nr
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "user_content";
DROP TABLE IF EXISTS "user_documents";
DROP TABLE IF EXISTS "system_configs";
DROP TABLE IF EXISTS "recovery_contacts";
DROP TABLE IF EXISTS "neupid_requests";
DROP TABLE IF EXISTS "kyc_requests";
DROP TABLE IF EXISTS "invitations";
