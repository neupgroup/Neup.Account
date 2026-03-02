'use server';

import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { headers } from 'next/headers';
import { switchToAccount as switchToAccountAction, switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction, switchToDependent as switchToDependentAction } from '@/lib/session';
import type { StoredAccount } from '@/types';
import { getSessionCookies, setStoredAccountsCookie, clearSessionCookies } from '@/lib/cookies';
import { createNotification } from '../notifications';

// This function is now just a wrapper or re-export if needed, but the main logic is in lib/session
// However, the client uses this file for actions.

export async function getStoredAccounts(): Promise<StoredAccount[]> {
    return getValidatedStoredAccounts();
}

export async function switchActiveAccount(account: StoredAccount) {
    const result = await switchToAccountAction(account);
    if(result.success) {
        await logActivity(account.accountId, `Switched to account: ${account.neupId}`, 'Success', undefined, undefined);
        await createNotification({
            recipient_id: account.accountId,
            action: 'informative.login',
            message: `Your account was accessed from a new device.`,
        });
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
        await createNotification({
            recipient_id: accountId,
            action: 'informative.logout',
            message: `A session was logged out.`,
        });


        const { allAccounts, sessionId: currentSessionId } = await getSessionCookies();
        
        // If signing out the active session, clear session cookies
        if (currentSessionId === sessionId) {
            await clearSessionCookies();
        }

        if (allAccounts.length > 0) {
            const updatedAccounts = allAccounts.map(acc => {
                if (acc.sessionId === sessionId) {
                    // Remove session details but keep account in list
                    return { 
                        ...acc, 
                        sessionId: undefined, 
                        sessionKey: undefined, 
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
        const { allAccounts, accountId: activeAccountId } = await getSessionCookies();
        
        // If removing the active account, clear session cookies
        if (accountId === activeAccountId) {
            await clearSessionCookies();
        }

        if (allAccounts.length > 0) {
            const filteredAccounts = allAccounts.filter(acc => acc.accountId !== accountId);
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
    return switchToBrandAction(brandId);
}

export async function switchToDependent(dependentId: string) {
    return switchToDependentAction(dependentId);
}

export async function switchToPersonal() {
    await switchToPersonalAction();
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
      if (!account.sessionId || !account.sessionKey) return { ...account, expired: true };

      try {
        const session = await prisma.session.findUnique({
            where: { id: account.sessionId }
        });

        if (!session) return { ...account, expired: true };

        const dbExpiresOn = session.expiresOn;

        const isInvalid =
          !dbExpiresOn ||
          dbExpiresOn < new Date() ||
          session.isExpired ||
          session.accountId !== account.accountId ||
          session.authSessionKey !== account.sessionKey;

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
