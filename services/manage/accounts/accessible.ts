'use server';

import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';
import type { StoredAccount } from '@/core/auth/session';

// Define a type that extends StoredAccount with the fields we need
export type AccessibleAccount = StoredAccount & {
    displayName: string;
    displayPhoto?: string;
    isBrand: boolean;
    isDependent: boolean;
    accountType: string;
    active: boolean;
};


/**
 * Function getAccessibleAccounts.
 */
export async function getAccessibleAccounts(): Promise<AccessibleAccount[]> {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) return [];

    try {
        // Query authzAccountAccessGrant: ownerAccountId is the account being managed,
        // targetAccountId is the account that has been granted access (the accessor).
        const grants = await prisma.authzAccountAccessGrant.findMany({
            where: {
                targetAccountId: personalAccountId,
                appId: 'neup.account',
            },
            include: {
                owner: {
                    include: {
                        neupIds: {
                            where: { isPrimary: true },
                        },
                    },
                },
            },
        });

        const seen = new Set<string>();
        const accounts = grants.map((grant) => {
            const ownerAccount = grant.owner;
            if (!ownerAccount) return null;
            // Skip duplicate grants for the same owner account
            if (seen.has(ownerAccount.id)) return null;
            seen.add(ownerAccount.id);

            const neupId = ownerAccount.neupIds[0]?.id || 'unknown';
            const displayName = ownerAccount.displayName || 'Unnamed Account';

            const accessibleAccount: AccessibleAccount = {
                aid: ownerAccount.id,
                def: 0,
                sid: '',
                skey: '',
                neupId,
                active: false,
                isBrand: ownerAccount.accountType === 'brand',
                isDependent: ownerAccount.accountType === 'dependent',
                accountType: ownerAccount.accountType,
                displayName,
                displayPhoto: ownerAccount.displayImage || undefined,
            };
            return accessibleAccount;
        });

        return accounts.filter((acc): acc is AccessibleAccount => acc !== null);

    } catch (error) {
        await logError('database', error, 'getAccessibleAccounts');
        return [];
    }
}
