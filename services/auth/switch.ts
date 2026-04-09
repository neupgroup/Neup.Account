'use server';

import prisma from '@/core/helpers/prisma';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { headers } from 'next/headers';
import { switchToAccount as switchToAccountAction, switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction, switchToDependent as switchToDependentAction } from '@/core/helpers/session';
import type { StoredAccount } from '@/types';
import { getSessionCookies, setStoredAccountsCookie, clearSessionCookies } from '@/core/helpers/cookies';
import { makeNotification } from '../notifications';

// This function is now just a wrapper or re-export if needed, but the main logic is in lib/session
// However, the client uses this file for actions.

export async function getStoredAccounts(): Promise<StoredAccount[]> {
    return getValidatedStoredAccounts();
}

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

export async function switchActiveAccountByNeupId(neupId: string) {
    const { switchToAccountByNeupId } = await import('@/core/helpers/session');
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

export async function logoutStoredSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    
    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return { success: false, error: "Session not found." };
        }
        
        const accountId = session.accountId;
        
        await prisma.$transaction([
            prisma.session.update({
                where: { id: sessionId },
                data: { isExpired: true }
            }),
            prisma.appSession.deleteMany({
                where: { sessionId: sessionId }
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
                    // Remove session details but keep account in list
                    return { 
                        ...acc, 
                        sid: undefined, 
                        skey: undefined, 
                        expired: true,
                        active: false 
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

export async function switchToBrand(brandId: string) {
    const result = await switchToBrandAction(brandId);

    if (result.success) {
        const { accountId } = await getSessionCookies();
        if (accountId) {
            await makeNotification({
                recipient_id: accountId,
                action: 'informative.switch',
                message: `You switched context to brand ${brandId}.`,
            });
        }
    }

    return result;
}

export async function switchToDependent(dependentId: string) {
    const result = await switchToDependentAction(dependentId);

    if (result.success) {
        const { accountId } = await getSessionCookies();
        if (accountId) {
            await makeNotification({
                recipient_id: accountId,
                action: 'informative.switch',
                message: `You switched context to dependent ${dependentId}.`,
            });
        }
    }

    return result;
}

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
      if (account.expired) return account;
      // If session info is missing, mark as expired but keep account
    if (!account.sid || !account.skey) return { ...account, expired: true };

      try {
        const session = await prisma.session.findUnique({
            where: { id: account.sid }
        });

        if (!session) return { ...account, expired: true };

        const dbExpiresOn = session.expiresOn;

        const isInvalid =
          !dbExpiresOn ||
          dbExpiresOn < new Date() ||
          session.isExpired ||
          session.accountId !== account.aid ||
          session.authSessionKey !== account.skey;

        if (isInvalid) {
            return { ...account, expired: true };
        }

        return account;
      } catch (e) {
        await logError('database', e, 'getValidatedStoredAccounts');
        return { ...account, expired: true };
      }
    })
  );
  return validatedAccounts;
}
