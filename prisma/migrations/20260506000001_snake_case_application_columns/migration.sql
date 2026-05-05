-- Rename camelCase columns to snake_case on the application table
ALTER TABLE "application"
  RENAME COLUMN "appSecret" TO "app_secret";

ALTER TABLE "application"
  RENAME COLUMN "isInternal" TO "is_internal";
