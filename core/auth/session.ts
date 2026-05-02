'use server';

import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';

import { logError } from '@/core/helpers/logger';

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
  def: 0 | 1;
  nid?: string;
  neupId?: string; // legacy compat — kept so callers that read neupId still work
  isBrand?: boolean;
  isUnknown?: boolean;
  // legacy aliases — kept for backward compat with callers that use the old field names
  accountId?: string;
  sessionId?: string;
  sessionKey?: string;
  expired?: boolean;
  displayName?: string;
  displayPhoto?: string;
  isDependent?: boolean;
  accountType?: string;
};
import { setStoredAccountsCookie, getSessionCookies, clearManagingCookie, setManagingCookie } from '@/core/helpers/cookies';
import { getUserNeupIds, validateNeupId } from '@/core/helpers/user';
import {
  getActiveSession as getActiveSessionAction,
  getActiveAccountId as getActiveAccountIdAction,
  getPersonalAccountId as getPersonalAccountIdAction,
  validateCurrentSession as validateCurrentSessionAction,
} from '@/core/auth/verify';

// --- Constants ---
const SESSION_DURATION_DAYS = 30;

// --- Session Logic ---

function normalizeStoredAccount(account: StoredAccount): StoredAccount {
  const sid = account.sid ?? account.sessionId;
  const skey = account.skey ?? account.sessionKey;
  const aid = account.aid ?? account.accountId ?? '';
  const nid = account.nid || account.neupId || '';

  return {
    ...account,
    aid,
    sid,
    skey,
    def: account.def ?? 0,
    nid,
    neupId: nid,
  };
}

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
        key: sessionKey,
        ipAddress: ipAddress,
        userAgent: userAgent,
        validTill: expiresOn,
        lastLoggedIn: new Date(),
        loginType: loginType,
        geolocation: geolocation,
      },
    });

    const { allAccounts: existingAccounts } = await getSessionCookies();

    const neupIds = await getUserNeupIds(accountId);
    const primaryNeupId = neupIds[0];

    const newStoredAccount: StoredAccount = {
      aid: accountId,
      sid: session.id,
      skey: sessionKey,
      def: 1,
      nid: primaryNeupId,
      neupId: primaryNeupId,
    };
    
    // Mark all others as def:0, remove previous session for this accountId, add new one
    const filteredAccounts = existingAccounts
      .map((acc: StoredAccount) => ({ ...acc, def: 0 as const }))
      .filter((acc: StoredAccount) => acc.aid !== accountId);

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
  return allAccounts.map(normalizeStoredAccount);
}

export async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  if (allAccounts.length === 0) {
    return [];
  }

  const { accountId: activeAccountId } = await getSessionCookies();

  const validatedAccounts = await Promise.all(
    allAccounts.map(async (rawAccount: StoredAccount) => {
      const account = normalizeStoredAccount(rawAccount);

      if (account.def !== 1) return account;
      if (!account.sid || !account.skey) return { ...account, def: 0 as const };

      try {
        const session = await prisma.authSession.findUnique({
          where: { id: account.sid },
          select: {
            id: true,
            accountId: true,
            key: true,
            validTill: true,
          },
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

export async function cleanupExpiredStoredSessions(): Promise<StoredAccount[]> {
  const validatedAccounts = await getValidatedStoredAccounts();

  const cleanedAccounts = validatedAccounts
    .map((rawAccount) => {
      const account = normalizeStoredAccount(rawAccount);
      if (account.def === 1 || account.sid) {
        return account;
      }
      // Strip session keys from accounts with no valid session
      const { sid: _sid, skey: _skey, sessionId: _sessionId, sessionKey: _sessionKey, ...rest } = account;
      return { ...rest, def: 0 as const } as StoredAccount;
    })
    .filter((account) => Boolean(account?.aid));

  let prunedAccounts = cleanedAccounts;
  try {
    const uniqueIds = Array.from(new Set(prunedAccounts.map((account) => account.aid).filter(Boolean)));
    if (uniqueIds.length > 0) {
      const existing = await prisma.account.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((entry) => entry.id));
      prunedAccounts = prunedAccounts.filter((account) => existingIds.has(account.aid));
    }
  } catch (error) {
    await logError('database', error, 'cleanupExpiredStoredSessions');
  }

  await setStoredAccountsCookie(prunedAccounts);
  return prunedAccounts;
}

// --- Account Switching ---
export async function switchToAccount(account: StoredAccount) {
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
            key: true,
            validTill: true,
          },
        });

        if (
          !session ||
          session.accountId !== account.aid ||
          !session.key ||
          session.key !== account.skey ||
          !session.validTill ||
          session.validTill < new Date()
        ) {
            return { success: false, error: 'Invalid or expired session.' };
        }

        await clearManagingCookie();

        const { allAccounts } = await getSessionCookies();
        const updatedAccounts = allAccounts.map((acc: StoredAccount) => ({
            ...acc,
            def: (acc.aid === account.aid ? 1 : 0) as 0 | 1,
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
    (account) => (account.nid || account.neupId)?.toLowerCase() === normalizedNeupId
  );

  if (!matchedAccount) {
    return { success: false, error: 'No stored session found for this NeupID.' };
  }

  if (!matchedAccount.sid || !matchedAccount.skey || matchedAccount.def !== 1) {
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
