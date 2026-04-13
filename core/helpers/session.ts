'use server';

import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';

import { logError } from './logger';

export type Session = {
  aid?: string;
  sid?: string;
  skey?: string;
  accountId: string;
  sessionId: string;
  sessionKey: string;
  jwt?: string;
};

export type StoredAccount = {
  aid: string;
  sid?: string;
  skey?: string;
  accountId?: string;
  sessionId?: string;
  sessionKey?: string;
  expired: boolean;
  neupId?: string;
  isBrand?: boolean;
  isUnknown?: boolean;
  active?: boolean;
};
import { setSessionCookies, setStoredAccountsCookie, getSessionCookies, clearManagingCookie, setManagingCookie } from './cookies';
import { getUserNeupIds, validateNeupId } from './user';
import {
  getActiveSession as getActiveSessionAction,
  getActiveAccountId as getActiveAccountIdAction,
  getPersonalAccountId as getPersonalAccountIdAction,
  validateCurrentSession as validateCurrentSessionAction,
} from './auth-actions';

// --- Constants ---
const SESSION_DURATION_DAYS = 30;

// --- Session Logic ---

export async function createAndSetSession(
  accountId: string,
  loginType: string,
  ipAddress: string,
  userAgent: string,
  geolocation?: string
) {
  try {
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    const sessionKey = crypto.randomUUID();

    const session = await prisma.authSession.create({
      data: {
        accountId: accountId,
        authSessionKey: sessionKey,
        ipAddress: ipAddress,
        userAgent: userAgent,
        isExpired: false,
        expiresOn: expiresOn,
        lastLoggedIn: new Date(),
        loginType: loginType,
        geolocation: geolocation,
      },
    });

    const newSession = {
      aid: accountId,
      sid: session.id,
      skey: sessionKey,
      accountId,
      sessionId: session.id,
      sessionKey,
    };

    await setSessionCookies(newSession, expiresOn);
    
    const { allAccounts: existingAccounts } = await getSessionCookies();
    
    const neupIds = await getUserNeupIds(accountId);
    const primaryNeupId = neupIds[0];

    // Mark all other accounts as inactive
    const updatedExistingAccounts = existingAccounts.map(acc => ({ ...acc, active: false }));

    const newStoredAccount: StoredAccount & { active: boolean } = {
      aid: accountId,
      sid: session.id,
      skey: sessionKey,
      expired: false,
      neupId: primaryNeupId,
      active: true, // This new session is the active one
    };
    
    // Remove any previous sessions for this accountId and add the new one.
    const filteredAccounts = updatedExistingAccounts
      .filter(acc => acc.aid !== accountId);

    const allAccounts = [...filteredAccounts, newStoredAccount];
    
    await setStoredAccountsCookie(allAccounts);

  } catch (error) {
    await logError('auth', error, `createAndSetSession for ${accountId}`);
    throw new Error('Failed to create session.');
  }
}

// --- Stored Account Management ---
export async function getStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  return allAccounts;
}

export async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  if (allAccounts.length === 0) {
    return [];
  }

  const { accountId: activeAccountId } = await getSessionCookies();

  const validatedAccounts = await Promise.all(
    allAccounts.map(async (account) => {
      if (account.expired) return account;
      if (!account.sid || !account.skey) return { ...account, expired: true };

      try {
        const session = await prisma.authSession.findUnique({
          where: { id: account.sid },
          select: {
            id: true,
            accountId: true,
            authSessionKey: true,
            expiresOn: true,
            isExpired: true,
          },
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

export async function cleanupExpiredStoredSessions(): Promise<StoredAccount[]> {
  const validatedAccounts = await getValidatedStoredAccounts();

  const cleanedAccounts = validatedAccounts.map((account) => {
    if (!account.expired) {
      return account;
    }

    const { sid: _sid, skey: _skey, ...rest } = account;
    return {
      ...rest,
      expired: true,
    };
  });

  await setStoredAccountsCookie(cleanedAccounts);
  return cleanedAccounts;
}

// --- Account Switching ---
export async function switchToAccount(account: StoredAccount) {
    if (account.expired) {
        return { success: false, error: 'Cannot switch to an expired session. Please sign in.' };
    }
    
    if (!account.sid || !account.skey) {
        return { success: false, error: 'Invalid session information. Please sign in.' };
    }
    
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    
    try {
        const session = await prisma.authSession.findUnique({
          where: { id: account.sid },
          select: {
            id: true,
            accountId: true,
            authSessionKey: true,
            isExpired: true,
          },
        });

        if (!session || 
          session.accountId !== account.aid ||
          session.authSessionKey !== account.skey ||
            session.isExpired) {
            return { success: false, error: 'Invalid or expired session.' };
        }

        // Clear any managing cookies to ensure we are back to a personal account context
        await clearManagingCookie();
        
        // Set the primary session cookies to the new account's details
        await setSessionCookies({
          aid: account.aid,
          sid: account.sid,
          skey: account.skey,
          accountId: account.aid,
          sessionId: account.sid,
          sessionKey: account.skey,
        }, expiresOn);
        
        const { allAccounts } = await getSessionCookies();
        const updatedAccounts = allAccounts.map(acc => ({
            ...acc,
          active: acc.aid === account.aid
        }));
        await setStoredAccountsCookie(updatedAccounts);


        return { success: true };
    } catch (error) {
        await logError('database', error, `switchActiveAccount: ${account.aid}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function switchToAccountByNeupId(neupId: string): Promise<{ success: boolean; error?: string }> {
  const normalizedNeupId = neupId.toLowerCase().trim();

  const validity = await validateNeupId(normalizedNeupId);
  if (!validity.success) {
    return { success: false, error: validity.error || 'Invalid NeupID.' };
  }

  const accounts = await getValidatedStoredAccounts();
  const matchedAccount = accounts.find(
    (account) => account.neupId?.toLowerCase() === normalizedNeupId
  );

  if (!matchedAccount) {
    return { success: false, error: 'No stored session found for this NeupID.' };
  }

  if (!matchedAccount.sid || !matchedAccount.skey || matchedAccount.expired) {
    return { success: false, error: 'Stored session is missing or expired.' };
  }

  return switchToAccount(matchedAccount);
}

export async function switchToBrand(brandId: string) {
  try {
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    await setManagingCookie(`brand.${brandId}`, expiresOn);
    return { success: true };
  } catch (error) {
    await logError('auth', error, `switchToBrand: ${brandId}`);
    return { success: false, error: 'Failed to switch to brand account.' };
  }
}

export async function switchToDependent(dependentId: string) {
  try {
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    await setManagingCookie(`dependent.${dependentId}`, expiresOn);
    return { success: true };
  } catch (error) {
    await logError('auth', error, `switchToDependent: ${dependentId}`);
    return { success: false, error: 'Failed to switch to dependent account.' };
  }
}

export async function switchToDelegated(accountId: string) {
  try {
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    await setManagingCookie(`delegated.${accountId}`, expiresOn);
    return { success: true };
  } catch (error) {
    await logError('auth', error, `switchToDelegated: ${accountId}`);
    return { success: false, error: 'Failed to switch to delegated account.' };
  }
}

export async function switchToPersonal() {
  try {
    await clearManagingCookie();
  } catch (error) {
    await logError('auth', error, `switchToPersonal`);
  }
}

export async function getActiveSession() {
  return getActiveSessionAction();
}

export async function getActiveAccountId() {
  return getActiveAccountIdAction();
}

export async function getPersonalAccountId() {
  return getPersonalAccountIdAction();
}

export async function validateCurrentSession() {
  return validateCurrentSessionAction();
}