DO $$
BEGIN
  IF to_regclass('public.account_status_logs') IS NOT NULL THEN
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
      asl."id",
      asl."accountId",
      asl."accountId",
      'Account Status: ' || COALESCE(asl."status", 'unknown') ||
      CASE
        WHEN asl."remarks" IS NULL OR asl."remarks" = '' THEN ''
        ELSE ' - ' || asl."remarks"
      END,
      CASE
        WHEN LOWER(COALESCE(asl."status", '')) = 'active' THEN 'Success'
        WHEN LOWER(COALESCE(asl."status", '')) = 'deletion_requested' THEN 'Pending'
        WHEN LOWER(COALESCE(asl."status", '')) = 'blocked' THEN 'Alert'
        ELSE 'Alert'
      END,
      'migrated',
      COALESCE(asl."fromDate", NOW()),
      asl."moreInfo"
    FROM "account_status_logs" asl
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS "account_status_logs";

ALTER TABLE IF EXISTS "activity_logs" RENAME TO "activity";
