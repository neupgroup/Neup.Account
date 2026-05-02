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
        const permits = await prisma.permit.findMany({
            where: {
                accountId: personalAccountId,
                forSelf: false,
                // We want all permits, regardless of account type
            },
            include: {
                targetAccount: {
                    include: {
                        neupIds: {
                            where: { isPrimary: true }
                        }
                    }
                }
            }
        });

        const accounts = await Promise.all(permits.map(async (permit) => {
            const targetAccount = permit.targetAccount;
            if (!targetAccount) return null;

            const neupId = targetAccount.neupIds[0]?.id || 'unknown';
            
            // Determine display name
            const displayName = targetAccount.displayName || 'Unnamed Account';

            const accessibleAccount: AccessibleAccount = {
                aid: targetAccount.id,
                def: 0,
                sid: '',
                skey: '',
                neupId: neupId,
                active: false,
                isBrand: targetAccount.accountType === 'brand',
                isDependent: targetAccount.accountType === 'dependent',
                accountType: targetAccount.accountType,
                displayName: displayName,
                displayPhoto: targetAccount.displayImage || undefined,
            };
            return accessibleAccount;
        }));

        return accounts.filter((acc): acc is AccessibleAccount => acc !== null);

    } catch (error) {
        await logError('database', error, 'getAccessibleAccounts');
        return [];
    }
}
