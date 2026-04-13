-- Drop columns from auth_session table if they exist
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_session' AND column_name='applicationdomain') THEN
        ALTER TABLE auth_session DROP COLUMN applicationdomain;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_session' AND column_name='applicationtype') THEN
        ALTER TABLE auth_session DROP COLUMN applicationtype;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_session' AND column_name='permissions') THEN
        ALTER TABLE auth_session DROP COLUMN permissions;
    END IF;
END $$;