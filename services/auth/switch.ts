'use server';

import prisma from '@/core/helpers/prisma';
import { logActivity } from '@/services/log-actions';
import { logError } from '@/core/helpers/logger';
import { headers } from 'next/headers';
import {
    switchToAccount as switchToAccountAction,
    switchToBrand as switchToBrandAction,
    switchToPersonal as switchToPersonalAction,
    switchToDependent as switchToDependentAction,
    switchToDelegated as switchToDelegatedAction,
} from '@/core/auth/session';
import type { StoredAccount } from '@/core/auth/session';
import { getSessionCookies, setStoredAccountsCookie, clearSessionCookies } from '@/core/helpers/cookies';
import { makeNotification } from '../notifications';
import { checkPermissions } from '@/services/user';
import { getPersonalAccountId } from '@/core/auth/verify';

export async function getStoredAccounts(): Promise<StoredAccount[]> {
    return getValidatedStoredAccounts();
}


/**
 * Function switchActiveAccount.
 */
export async function switchActiveAccount(account: StoredAccount) {
    const result = await switchToAccountAction(account);
    if(result.success) {
        await logActivity(account.aid, `Switched to account: ${account.neupId}`, 'Success', undefined, undefined);
        await makeNotification({
            recipient_id: account.aid,
            action: 'informative.switch',
            message: 'You switched to this account.',
        });
    }
    return result;
}


/**
 * Function switchActiveAccountByNeupId.
 */
export async function switchActiveAccountByNeupId(neupId: string) {
    const { switchToAccountByNeupId } = await import('@/core/auth/session');
    const result = await switchToAccountByNeupId(neupId);

    if (result.success) {
        const matchedNeupId = await prisma.neupId.findUnique({
            where: { id: neupId.toLowerCase().trim() },
            select: { accountId: true },
        });

        await logActivity('self', `Switched account by NeupID: ${neupId}`, 'Success', undefined, undefined);

        if (matchedNeupId?.accountId) {
            await makeNotification({
                recipient_id: matchedNeupId.accountId,
                action: 'informative.switch',
                message: `You switched to this account using NeupID ${neupId}.`,
            });
        }
    }

    return result;
}


/**
 * Function logoutStoredSession.
 */
export async function logoutStoredSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    
    try {
        const session = await prisma.authnSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return { success: false, error: "Session not found." };
        }
        
        const accountId = session.accountId;
        
        await prisma.$transaction([
            prisma.authnSession.update({
                where: { id: sessionId },
                data: { validTill: new Date() }
            })
        ]);

        await logActivity(accountId, 'Signout', 'Success', ipAddress);
        await makeNotification({
            recipient_id: accountId,
            action: 'informative.logout',
            message: `A session was logged out.`,
        });


        const { allAccounts, sid: currentSessionId } = await getSessionCookies();
        
        // If signing out the active session, clear session cookies
        if (currentSessionId === sessionId) {
            await clearSessionCookies();
        }

        if (allAccounts.length > 0) {
            const updatedAccounts = allAccounts.map(acc => {
                if (acc.sid === sessionId) {
                    return {
                        ...acc,
                        sid: undefined,
                        skey: undefined,
                        def: 0 as const,
                    };
                }
                return acc;
            });
            await setStoredAccountsCookie(updatedAccounts as StoredAccount[]);
        }
        return { success: true };
    } catch (error) {
        await logError('database', error, `logoutStoredSession: ${sessionId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}


/**
 * Function removeStoredAccount.
 */
export async function removeStoredAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { allAccounts, aid: activeAccountId } = await getSessionCookies();
        
        // If removing the active account, clear session cookies
        if (accountId === activeAccountId) {
            await clearSessionCookies();
        }

        if (allAccounts.length > 0) {
            const filteredAccounts = allAccounts.filter(acc => acc.aid !== accountId);
            await setStoredAccountsCookie(filteredAccounts);
        }
        
        await logActivity(accountId, 'Removed account from device', 'Success');
        return { success: true };
    } catch (error) {
        await logError('unknown', error, `removeStoredAccount: ${accountId}`);
        return { success: false, error: "Failed to remove account from device." };
    }
}


/**
 * Function switchToBrand.
 */
export async function switchToBrand(brandId: string) {
    const canSwitch = await checkPermissions(['linked_accounts.brand.view']);
    if (!canSwitch) {
        return { success: false, error: 'Permission denied.' };
    }

    // Verify the brand actually belongs to the personal account
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return { success: false, error: 'Not authenticated.' };
    }

    const ownership = await prisma.accountOwnership.findFirst({
        where: { parentId: personalAccountId, childrenId: brandId, type: 'brand' },
        select: { id: true },
    });
    if (!ownership) {
        return { success: false, error: 'Brand account not found or not owned by you.' };
    }

    const result = await switchToBrandAction(brandId);

    if (result.success) {
        await makeNotification({
            recipient_id: personalAccountId,
            action: 'informative.switch',
            message: `You switched context to brand ${brandId}.`,
        });
    }

    return result;
}


/**
 * Function switchToDependent.
 */
export async function switchToDependent(dependentId: string) {
    const canSwitch = await checkPermissions(['linked_accounts.dependent.view']);
    if (!canSwitch) {
        return { success: false, error: 'Permission denied.' };
    }

    // Verify the dependent actually belongs to the personal account
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return { success: false, error: 'Not authenticated.' };
    }

    const ownership = await prisma.accountOwnership.findFirst({
        where: { parentId: personalAccountId, childrenId: dependentId, type: 'dependent' },
        select: { id: true },
    });
    if (!ownership) {
        return { success: false, error: 'Dependent account not found or not owned by you.' };
    }

    const result = await switchToDependentAction(dependentId);

    if (result.success) {
        await makeNotification({
            recipient_id: personalAccountId,
            action: 'informative.switch',
            message: `You switched context to dependent ${dependentId}.`,
        });
    }

    return result;
}


/**
 * Function switchToDelegated.
 */
export async function switchToDelegated(accountId: string) {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return { success: false, error: 'Not authenticated.' };
    }

    // Verify a grant exists giving this account access to the delegated account
    const grant = await prisma.authzAccountAccessGrant.findFirst({
        where: { ownerAccountId: accountId, targetAccountId: personalAccountId, appId: 'neup.account' },
        select: { id: true },
    });
    if (!grant) {
        return { success: false, error: 'No delegated access found for this account.' };
    }

    const result = await switchToDelegatedAction(accountId);

    if (result.success) {
        await makeNotification({
            recipient_id: personalAccountId,
            action: 'informative.switch',
            message: `You switched context to delegated account ${accountId}.`,
        });
    }

    return result;
}


/**
 * Function switchToPersonal.
 */
export async function switchToPersonal() {
    await switchToPersonalAction();

    const { accountId } = await getSessionCookies();
    if (accountId) {
        await makeNotification({
            recipient_id: accountId,
            action: 'informative.switch',
            message: 'You switched context back to personal account.',
        });
    }
}


/**
 * Function bridgeSwitchAccountBySessionId.
 */
export async function bridgeSwitchAccountBySessionId(input: {
    requestUrl: string;
    sessionId?: string | null;
}): Promise<{ redirectTo: string }> {
    const { requestUrl, sessionId } = input;

    if (!sessionId) {
        const errorUrl = new URL('/auth/start', requestUrl);
        errorUrl.searchParams.set('error', 'invalid_request');
        return { redirectTo: errorUrl.toString() };
    }

    const storedAccounts = await getStoredAccounts();
    const accountToSwitch = storedAccounts.find((acc) => acc.sessionId === sessionId);

    if (!accountToSwitch) {
        const errorUrl = new URL('/auth/start', requestUrl);
        errorUrl.searchParams.set('error', 'session_not_found');
        return { redirectTo: errorUrl.toString() };
    }

    const result = await switchToAccountAction(accountToSwitch);

    if (result.success) {
        const manageUrl = new URL('/', requestUrl);
        return { redirectTo: manageUrl.toString() };
    }

    const errorUrl = new URL('/auth/start', requestUrl);
    errorUrl.searchParams.set('error', 'switch_failed');
    if (result.error) {
        errorUrl.searchParams.set('error_description', result.error);
    }

    return { redirectTo: errorUrl.toString() };
}


// Local helper to validate accounts using Prisma
async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  if (allAccounts.length === 0) {
    return [];
  }

  const validatedAccounts = await Promise.all(
    allAccounts.map(async (account) => {
      if (account.def !== 1) return account;
      if (!account.sid || !account.skey) return { ...account, def: 0 as const, sid: undefined, skey: undefined };

      try {
        const session = await prisma.authnSession.findUnique({
            where: { id: account.sid }
        });

        if (!session) return { ...account, def: 0 as const, sid: undefined, skey: undefined };

        const dbValidTill = session.validTill;
        const dbKey = session.key;

        const isInvalid =
          !dbValidTill ||
          dbValidTill < new Date() ||
          session.accountId !== account.aid ||
          !dbKey ||
          dbKey !== account.skey;

        if (isInvalid) {
            return { ...account, def: 0 as const, sid: undefined, skey: undefined };
        }

        return account;
      } catch (e) {
        await logError('database', e, 'getValidatedStoredAccounts');
        return { ...account, def: 0 as const, sid: undefined, skey: undefined };
      }
    })
  );
  return validatedAccounts;
}
