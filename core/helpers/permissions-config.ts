// Static permission definitions for the Neup.Account permission system.
// DEFAULT_PERMISSIONS is the baseline set granted to every regular account.
// ROOT_PERMISSIONS extends the default set with admin-only capabilities.
// These strings are stored in permit records and checked at runtime via getUserPermissions().

export const DEFAULT_PERMIT_TYPE = 'default';

export const DEFAULT_PERMISSIONS: string[] = [
    // Personal Info
    'profile.view', 'profile.modify', 'contact.view', 'contact.add', 'contact.modify', 'contact.remove',
    
    // Notifications
    'notification.read', 'notification.delete',
    
    // Password & Security
    'security.pass.modify', 'security.totp.add', 'security.totp.remove', 'security.backup_codes.view', 
    'security.backup_codes.create', 'security.recovery_accounts.view', 'security.recovery_accounts.add', 
    'security.recovery_accounts.remove', 'security.recovery_phone.view', 'security.recovery_phone.add', 
    'security.recovery_phone.remove', 'security.recovery_email.view', 'security.recovery_email.add', 
    'security.recovery_email.remove', 'security.login_devices.view',

    // Linked Accounts
    'linked_accounts.brand.create', 'linked_accounts.brand.view', 'linked_accounts.dependent.create', 'linked_accounts.dependent.view',

    // Data & Privacy
    'data.agreed_terms.view', 'data.delete_account.start', 'data.deactivate_account.start', 
    'data.materialization.view', 'data.materialization.modify', 'security.third_party.view', 'security.recent_activities.view',

    // Access & Control
    'security.third_party.view', 'security.third_party.add', 'security.third_party.remove',

    // People & Sharing
    'people.family.view', 'people.family.add', 'people.family.remove', 'people.family.partner.add', 'people.family.partner.remove', 'people.block_list.view', 'people.restrict_list.view',

    // Payment & Subscription
    'payment.method.show', 'payment.transactions.show', 'payment.subscriptions.show', 'payment.purchase_neup_pro.view'
];

// Extends DEFAULT_PERMISSIONS with admin-only permissions for root users.
export const ROOT_PERMISSIONS: string[] = [
    ...DEFAULT_PERMISSIONS,

    // Root-only
    'admin.accounts.view', 'admin.accounts.modify', 'admin.accounts.delete',
    'admin.applications.view', 'admin.applications.modify', 'admin.applications.delete',
    'admin.permits.view', 'admin.permits.modify', 'admin.permits.delete',
    'admin.verifications.view', 'admin.verifications.modify',
    'admin.system.view', 'admin.system.modify',
];

export type PermitType = 'default' | 'addition' | 'reduction' | 'addition_reduction';
