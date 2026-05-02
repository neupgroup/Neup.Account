-- Migration: Drop permit table and related constraints

-- Drop foreign key constraints referencing permits if any exist
-- (Assuming no additional tables reference permits beyond the permits table itself)

DROP TABLE IF EXISTS permit CASCADE;

-- If you prefer to keep historical data, consider renaming instead:
-- ALTER TABLE IF EXISTS permit RENAME TO permit_archived;

-- Notes: After running this, update application code to use `role` and `access` tables for permission management.
