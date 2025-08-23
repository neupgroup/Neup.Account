

'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, query, where, getDocs, doc } from 'firebase/firestore';

const allPermissions = {
    'individual.default': [
        'profile.view', 'profile.modify', 'contact.view', 'contact.add', 'contact.modify', 'contact.remove',
        'security.pass.modify', 'security.totp.add', 'security.totp.remove',
        'security.backup_codes.view', 'security.backup_codes.create',
        'security.recovery_accounts.view', 'security.recovery_accounts.add', 'security.recovery_accounts.remove',
        'security.recovery_phone.view', 'security.recovery_phone.add', 'security.recovery_phone.remove',
        'security.recovery_email.view', 'security.recovery_email.add', 'security.recovery_email.remove',
        'security.login_devices.view', 'security.recent_activities.view', 'security.third_party.view',
        'data.agreed_terms.view', 'data.delete_account.start', 'data.deactivate_account.start',
        'data.materialization.view', 'data.materialization.modify',
        'linked_accounts.brand.create', 'linked_accounts.brand.view', 'linked_accounts.brand.manage',
        'linked_accounts.dependent.create', 'linked_accounts.dependent.view',
        'people.family.view', 'people.family.add', 'people.family.remove', 'people.family.partner.add', 'people.family.partner.remove',
        'payment.method.show', 'payment.transactions.show', 'payment.subscriptions.show', 'payment.purchase_neup_pro.view',
        'notification.read', 'notification.mark_as_read'
    ],
    'root.whole': [
        'root.dashboard.view', 'root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2',
        'root.account.search', 'root.account.create_individual', 'root.account.view_activity', 'root.account.impersonate',
        'root.account.send_warning', 'root.account.give_block_account', 'root.account.remove_block_account',
        'root.requests.view', 'root.requests.approve', 'root.requests.deny',
        'root.permission.view', 'root.permission.create', 'root.permission.edit', 'root.permission.delete', 'root.permission.bulk_import',
        'root.app.view', 'root.app.create',
        'root.payment_config.view', 'root.payment_config.edit',
        'root.errors.view',
        'root.site.social_accounts.read', 'root.site.social_accounts.add', 'root.site.social_accounts.edit', 'root.site.social_accounts.delete'
    ]
};

export async function populatePermissions(): Promise<{ success: boolean; messages?: string[]; error?: string }> {
    const messages: string[] = [];
    try {
        const batch = writeBatch(db);
        const permissionRef = collection(db, 'permission');

        for (const [name, access] of Object.entries(allPermissions)) {
            const q = query(permissionRef, where('name', '==', name));
            const existing = await getDocs(q);

            if (existing.empty) {
                const docRef = doc(collection(db, 'permission'));
                batch.set(docRef, {
                    name,
                    access,
                    app_id: 'neup_console',
                    description: name === 'root.whole' ? 'Grants full access to all system features.' : 'Default permissions for all individual users.'
                });
                messages.push(`Created '${name}' permission set.`);
            } else {
                messages.push(`Permission set '${name}' already exists. Skipped.`);
            }
        }
        
        await batch.commit();
        return { success: true, messages };
    } catch (e) {
        console.error(e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred.';
        return { success: false, error };
    }
}
