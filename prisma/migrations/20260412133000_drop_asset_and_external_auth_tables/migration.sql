-- Drop asset and external-auth/app-auth tables requested for consolidation.
DROP TABLE IF EXISTS "assetMemberRole" CASCADE;
DROP TABLE IF EXISTS "assetGroupMember" CASCADE;
DROP TABLE IF EXISTS "assetGroupInfo" CASCADE;
DROP TABLE IF EXISTS "asset" CASCADE;

DROP TABLE IF EXISTS "app_authentication" CASCADE;
DROP TABLE IF EXISTS "app_session" CASCADE;
DROP TABLE IF EXISTS "app_authentications" CASCADE;
DROP TABLE IF EXISTS "app_sessions" CASCADE;

DROP TABLE IF EXISTS "auth_permission_recipients" CASCADE;
DROP TABLE IF EXISTS "auth_permissions_external" CASCADE;
DROP TABLE IF EXISTS "auth_roles_external" CASCADE;
DROP TABLE IF EXISTS "auth_sessions_external" CASCADE;
DROP TABLE IF EXISTS "auth_teams_external" CASCADE;