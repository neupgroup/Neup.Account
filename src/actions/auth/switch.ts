

'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { headers } from 'next/headers';
import { switchToAccount as switchToAccountAction, switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction, switchToDependent as switchToDependentAction } from '@/lib/session';
import type { StoredAccount } from '@/types';
import { getSessionCookies, setStoredAccountsCookie } from '@/lib/cookies';

export async function getStoredAccounts(): Promise<StoredAccount[]> {
    return getValidatedStoredAccounts();
}

export async function switchActiveAccount(account: StoredAccount) {
    const result = await switchToAccountAction(account);
    if(result.success) {
        await logActivity(account.accountId, `Switched to account: ${account.neupId}`);
    }
    return result;
}

export async function logoutStoredSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';
    
    try {
        const sessionRef = doc(db, 'session', sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
            return { success: false, error: "Session not found." };
        }
        
        const accountId = sessionDoc.data().accountId;
        await updateDoc(sessionRef, { isExpired: true });
        await logActivity(accountId, 'Signout', 'Success', ipAddress);

        const { allAccounts } = await getSessionCookies();
        if (allAccounts.length > 0) {
            const updatedAccounts = allAccounts.map(acc => {
                if (acc.sessionId === sessionId) {
                    return { ...acc, expired: true };
                }
                return acc;
            });
            await setStoredAccountsCookie(updatedAccounts);
        }
        return { success: true };
    } catch (error) {
        await logError('database', error, `logoutStoredSession: ${sessionId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function removeStoredAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { allAccounts } = await getSessionCookies();
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

async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  if (allAccounts.length === 0) {
    return [];
  }

  const validatedAccounts = await Promise.all(
    allAccounts.map(async (account) => {
      if (account.expired) return account;
      if (!account.sessionId) return { ...account, expired: true };

      try {
        const sessionRef = doc(db, 'session', account.sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) return { ...account, expired: true };

        const sessionData = sessionDoc.data();
        const dbExpiresOn = sessionData.expiresOn?.toDate();

        const isInvalid =
          !dbExpiresOn ||
          dbExpiresOn < new Date() ||
          sessionData.isExpired ||
          sessionData.accountId !== account.accountId ||
          sessionData.auth_session_key !== account.sessionKey;

        return { ...account, expired: isInvalid };
      } catch (e) {
        await logError('database', e, 'getValidatedStoredAccounts');
        return { ...account, expired: true };
      }
    })
  );
  return validatedAccounts;
}
