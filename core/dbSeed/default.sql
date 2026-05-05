-- =============================================================================
-- default.sql
-- Bootstrap data for neup.account — safe to push to any fresh database.
--
-- What this covers:
--   1. The neup.account application itself
--   2. Three roles:  individual.default | individual.root | application.owner
--   3. One capability per permission string, scoped to its role
--   4. Role-capability maps with denormalized capability arrays
--
-- All statements use ON CONFLICT DO NOTHING so the file is fully idempotent —
-- safe to re-run against a database that already has some or all of this data.
--
-- Push to a live server:
--   psql $DATABASE_URL -f core/dbSeed/default.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Application
-- ---------------------------------------------------------------------------

INSERT INTO "application" (
  "id", "name", "description", "icon", "website",
  "app_secret", "created_at", "endpoints", "status", "is_internal", "details"
) VALUES (
  'neup.account',
  'neup.account',
  'Official NeupAccount Application.',
  'https://neupcdn.com/neupaccount/assets/logo.png',
  'https://neupgroup.com/account',
  NULL,
  NOW(),
  '"https://neupgroup.com/account"',
  'active',
  TRUE,
  '[]'
) ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Roles
--    Stable UUIDs so capability FKs are predictable across environments.
-- ---------------------------------------------------------------------------

INSERT INTO "authz_role" ("id", "name", "description", "app_id", "scope") VALUES
  ('individual-default-neup-account', 'individual.default', 'Default permission set for individual accounts.', 'neup.account', 'default'),
  ('root-full-neup-account', 'individual.root', 'Full root permission set for root accounts.', 'neup.account', 'root'),
  ('base-app-creator-neup-account', 'application.owner', 'Role for application creators and owners.', 'neup.account', 'creator')
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Capabilities + Role-Capability maps
--
-- Layout per block:
--   a) INSERT capabilities  (one row per permission string)
--   b) INSERT role_capability maps referencing those capability IDs
--
-- denormalized_capability stores the full permission list for the role as a
-- JSON array — this is what getIndividualAccountPermission() reads at runtime.
-- ---------------------------------------------------------------------------


-- ===== individual.default =================================================
-- Permissions: all non-admin, non-root strings from PERMISSION_SET
-- (union of independent.default + dependent.full + application.owner,
--  minus anything starting with root. or admin.)

INSERT INTO "authz_capability" ("id", "name", "app_id", "scope") VALUES
  ('cap-def-profile-view',                    'profile.view',                       'neup.account', 'default'),
  ('cap-def-profile-modify',                  'profile.modify',                     'neup.account', 'default'),
  ('cap-def-contact-view',                    'contact.view',                       'neup.account', 'default'),
  ('cap-def-contact-add',                     'contact.add',                        'neup.account', 'default'),
  ('cap-def-contact-modify',                  'contact.modify',                     'neup.account', 'default'),
  ('cap-def-contact-remove',                  'contact.remove',                     'neup.account', 'default'),
  ('cap-def-notification-read',               'notification.read',                  'neup.account', 'default'),
  ('cap-def-notification-delete',             'notification.delete',                'neup.account', 'default'),
  ('cap-def-security-pass-modify',            'security.pass.modify',               'neup.account', 'default'),
  ('cap-def-security-totp-add',               'security.totp.add',                  'neup.account', 'default'),
  ('cap-def-security-totp-remove',            'security.totp.remove',               'neup.account', 'default'),
  ('cap-def-security-backup-view',            'security.backup_codes.view',         'neup.account', 'default'),
  ('cap-def-security-backup-create',          'security.backup_codes.create',       'neup.account', 'default'),
  ('cap-def-security-recovery-accts-view',    'security.recovery_accounts.view',    'neup.account', 'default'),
  ('cap-def-security-recovery-accts-add',     'security.recovery_accounts.add',     'neup.account', 'default'),
  ('cap-def-security-recovery-accts-remove',  'security.recovery_accounts.remove',  'neup.account', 'default'),
  ('cap-def-security-recovery-phone-view',    'security.recovery_phone.view',       'neup.account', 'default'),
  ('cap-def-security-recovery-phone-add',     'security.recovery_phone.add',        'neup.account', 'default'),
  ('cap-def-security-recovery-phone-remove',  'security.recovery_phone.remove',     'neup.account', 'default'),
  ('cap-def-security-recovery-email-view',    'security.recovery_email.view',       'neup.account', 'default'),
  ('cap-def-security-recovery-email-add',     'security.recovery_email.add',        'neup.account', 'default'),
  ('cap-def-security-recovery-email-remove',  'security.recovery_email.remove',     'neup.account', 'default'),
  ('cap-def-security-devices-view',           'security.login_devices.view',        'neup.account', 'default'),
  ('cap-def-linked-brand-create',             'linked_accounts.brand.create',       'neup.account', 'default'),
  ('cap-def-linked-brand-view',               'linked_accounts.brand.view',         'neup.account', 'default'),
  ('cap-def-linked-dependent-create',         'linked_accounts.dependent.create',   'neup.account', 'default'),
  ('cap-def-linked-dependent-view',           'linked_accounts.dependent.view',     'neup.account', 'default'),
  ('cap-def-data-terms-view',                 'data.agreed_terms.view',             'neup.account', 'default'),
  ('cap-def-data-delete-start',               'data.delete_account.start',          'neup.account', 'default'),
  ('cap-def-data-deactivate-start',           'data.deactivate_account.start',      'neup.account', 'default'),
  ('cap-def-data-materialization-view',       'data.materialization.view',          'neup.account', 'default'),
  ('cap-def-data-materialization-modify',     'data.materialization.modify',        'neup.account', 'default'),
  ('cap-def-security-third-party-view',       'security.third_party.view',          'neup.account', 'default'),
  ('cap-def-security-recent-activities',      'security.recent_activities.view',    'neup.account', 'default'),
  ('cap-def-security-third-party-add',        'security.third_party.add',           'neup.account', 'default'),
  ('cap-def-security-third-party-remove',     'security.third_party.remove',        'neup.account', 'default'),
  ('cap-def-people-family-view',              'people.family.view',                 'neup.account', 'default'),
  ('cap-def-people-family-add',               'people.family.add',                  'neup.account', 'default'),
  ('cap-def-people-family-remove',            'people.family.remove',               'neup.account', 'default'),
  ('cap-def-people-family-partner-add',       'people.family.partner.add',          'neup.account', 'default'),
  ('cap-def-people-family-partner-remove',    'people.family.partner.remove',       'neup.account', 'default'),
  ('cap-def-people-block-list-view',          'people.block_list.view',             'neup.account', 'default'),
  ('cap-def-people-restrict-list-view',       'people.restrict_list.view',          'neup.account', 'default'),
  ('cap-def-payment-method-show',             'payment.method.show',                'neup.account', 'default'),
  ('cap-def-payment-transactions-show',       'payment.transactions.show',          'neup.account', 'default'),
  ('cap-def-payment-subscriptions-show',      'payment.subscriptions.show',         'neup.account', 'default'),
  ('cap-def-payment-neup-pro-view',           'payment.purchase_neup_pro.view',     'neup.account', 'default'),
  ('cap-def-linked-brand-manager',            'linked_accounts.brand.manager',      'neup.account', 'default')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "authz_role_capability" (
  "id", "role_id", "capability_id", "scope", "app_id", "role_name", "denormalized_capability"
)
SELECT
  'rcp-def-' || c."id",
  'individual-default-neup-account',
  c."id",
  'default',
  'neup.account',
  'individual.default',
  '["profile.view","profile.modify","contact.view","contact.add","contact.modify","contact.remove","notification.read","notification.delete","security.pass.modify","security.totp.add","security.totp.remove","security.backup_codes.view","security.backup_codes.create","security.recovery_accounts.view","security.recovery_accounts.add","security.recovery_accounts.remove","security.recovery_phone.view","security.recovery_phone.add","security.recovery_phone.remove","security.recovery_email.view","security.recovery_email.add","security.recovery_email.remove","security.login_devices.view","linked_accounts.brand.create","linked_accounts.brand.view","linked_accounts.dependent.create","linked_accounts.dependent.view","data.agreed_terms.view","data.delete_account.start","data.deactivate_account.start","data.materialization.view","data.materialization.modify","security.third_party.view","security.recent_activities.view","security.third_party.add","security.third_party.remove","people.family.view","people.family.add","people.family.remove","people.family.partner.add","people.family.partner.remove","people.block_list.view","people.restrict_list.view","payment.method.show","payment.transactions.show","payment.subscriptions.show","payment.purchase_neup_pro.view","linked_accounts.brand.manager"]'::jsonb
FROM "authz_capability" c
WHERE c."app_id" = 'neup.account'
  AND c."scope"  = 'default'
ON CONFLICT ("id") DO NOTHING;


-- ===== individual.root ====================================================
-- Permissions: admin.* only (from ROOT_PERMISSIONS in permissions-config.ts)

INSERT INTO "authz_capability" ("id", "name", "app_id", "scope") VALUES
  ('cap-root-admin-accounts-view',         'admin.accounts.view',          'neup.account', 'root'),
  ('cap-root-admin-accounts-modify',       'admin.accounts.modify',        'neup.account', 'root'),
  ('cap-root-admin-accounts-delete',       'admin.accounts.delete',        'neup.account', 'root'),
  ('cap-root-admin-applications-view',     'admin.applications.view',      'neup.account', 'root'),
  ('cap-root-admin-applications-modify',   'admin.applications.modify',    'neup.account', 'root'),
  ('cap-root-admin-applications-delete',   'admin.applications.delete',    'neup.account', 'root'),
  ('cap-root-admin-permits-view',          'admin.permits.view',           'neup.account', 'root'),
  ('cap-root-admin-permits-modify',        'admin.permits.modify',         'neup.account', 'root'),
  ('cap-root-admin-permits-delete',        'admin.permits.delete',         'neup.account', 'root'),
  ('cap-root-admin-verifications-view',    'admin.verifications.view',     'neup.account', 'root'),
  ('cap-root-admin-verifications-modify',  'admin.verifications.modify',   'neup.account', 'root'),
  ('cap-root-admin-system-view',           'admin.system.view',            'neup.account', 'root'),
  ('cap-root-admin-system-modify',         'admin.system.modify',          'neup.account', 'root')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "authz_role_capability" (
  "id", "role_id", "capability_id", "scope", "app_id", "role_name", "denormalized_capability"
)
SELECT
  'rcp-root-' || c."id",
  'root-full-neup-account',
  c."id",
  'root',
  'neup.account',
  'individual.root',
  '["admin.accounts.view","admin.accounts.modify","admin.accounts.delete","admin.applications.view","admin.applications.modify","admin.applications.delete","admin.permits.view","admin.permits.modify","admin.permits.delete","admin.verifications.view","admin.verifications.modify","admin.system.view","admin.system.modify"]'::jsonb
FROM "authz_capability" c
WHERE c."app_id" = 'neup.account'
  AND c."scope"  = 'root'
ON CONFLICT ("id") DO NOTHING;


-- ===== application.owner ==================================================
-- Permissions: application.view | application.edit | application.delete

INSERT INTO "authz_capability" ("id", "name", "app_id", "scope") VALUES
  ('cap-appowner-application-view',    'application.view',    'neup.account', 'creator'),
  ('cap-appowner-application-edit',    'application.edit',    'neup.account', 'creator'),
  ('cap-appowner-application-delete',  'application.delete',  'neup.account', 'creator')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "authz_role_capability" (
  "id", "role_id", "capability_id", "scope", "app_id", "role_name", "denormalized_capability"
)
SELECT
  'rcp-appowner-' || c."id",
  'base-app-creator-neup-account',
  c."id",
  'creator',
  'neup.account',
  'application.owner',
  '["application.view","application.edit","application.delete"]'::jsonb
FROM "authz_capability" c
WHERE c."app_id" = 'neup.account'
  AND c."scope"  = 'creator'
ON CONFLICT ("id") DO NOTHING;


COMMIT;
