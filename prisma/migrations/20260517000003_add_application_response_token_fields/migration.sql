-- Add explicit columns for application-configurable response/token fields.
-- These replace the previous JSON-in-details approach.

ALTER TABLE "application"
ADD COLUMN IF NOT EXISTS "response_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "application"
ADD COLUMN IF NOT EXISTS "token_fields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill from legacy JSON storage when present.
-- - details.access       -> response_fields
-- - details.token_fields -> token_fields
UPDATE "application" a
SET "response_fields" = sub.fields
FROM (
  SELECT
    a2.id,
    COALESCE(array_agg(value), ARRAY[]::TEXT[]) AS fields
  FROM "application" a2
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(a2.details->'access', '[]'::jsonb)) AS value
  GROUP BY a2.id
) sub
WHERE a.id = sub.id
  AND COALESCE(array_length(a."response_fields", 1), 0) = 0
  AND a.details ? 'access';

UPDATE "application" a
SET "token_fields" = sub.fields
FROM (
  SELECT
    a2.id,
    COALESCE(array_agg(value), ARRAY[]::TEXT[]) AS fields
  FROM "application" a2
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(a2.details->'token_fields', '[]'::jsonb)) AS value
  GROUP BY a2.id
) sub
WHERE a.id = sub.id
  AND COALESCE(array_length(a."token_fields", 1), 0) = 0
  AND a.details ? 'token_fields';
