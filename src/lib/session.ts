
'use server';

import { db } from './firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import crypto from 'crypto';

import { logError } from './logger';
import type { Session, StoredAccount } from '@/types';
import { setSessionCookies, setStoredAccountsCookie, getSessionCookies, clearManagingCookie, setManagingCookie } from './cookies';
import { getUserNeupIds } from './user';

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

    const sessionData: { [key: string]: any } = {
      accountId: accountId,
      auth_session_key: sessionKey,
      ipAddress: ipAddress,
      userAgent: userAgent,
      isExpired: false,
      expiresOn: Timestamp.fromDate(expiresOn),
      lastLoggedIn: serverTimestamp(),
      loginType: loginType,
    };

    if (geolocation) {
      sessionData.geolocation = geolocation;
    }

    const newSessionDocRef = await addDoc(collection(db, 'session'), sessionData);

    const newSession: Session = {
      accountId: accountId,
      sessionId: newSessionDocRef.id,
      sessionKey: sessionKey,
    };

    await setSessionCookies(newSession, expiresOn);
    
    // We no longer set profile cookies here. This is handled client-side.

    const { allAccounts: existingAccounts } = await getSessionCookies();
    
    // Fetch NeupID for the stored account object
    const neupIds = await getUserNeupIds(accountId);
    const primaryNeupId = neupIds[0];


    const newStoredAccount: StoredAccount = {
      accountId: accountId,
      sessionId: newSessionDocRef.id,
      sessionKey: sessionKey,
      expired: false,
      neupId: primaryNeupId,
    };
    
    let accountFound = false;
    const allAccounts = existingAccounts.map((acc) => {
      if (acc.accountId === accountId) {
        accountFound = true;
        return newStoredAccount;
      }
      return acc;
    });

    if (!accountFound) {
      allAccounts.push(newStoredAccount);
    }

    await setStoredAccountsCookie(allAccounts);
  } catch (error) {
    await logError('auth', error, `createAndSetSession for ${accountId}`);
    // If session creation fails, we should not proceed.
    // This is a critical error.
    throw new Error('Failed to create session.');
  }
}

// --- Stored Account Management ---
export async function getStoredAccounts(): Promise<StoredAccount[]> {
  const { allAccounts } = await getSessionCookies();
  return allAccounts;
}

export async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
  const storedAccounts = await getStoredAccounts();
  if (storedAccounts.length === 0) {
    return [];
  }

  const validatedAccounts = await Promise.all(
    storedAccounts.map(async (account) => {
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

// --- Account Switching ---
export async function switchToAccount(account: StoredAccount) {
    if (account.expired) {
        return { success: false, error: 'Cannot switch to an expired session. Please sign in.' };
    }
    
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    
    try {
        const sessionRef = doc(db, 'session', account.sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists() || 
            sessionDoc.data().accountId !== account.accountId ||
            sessionDoc.data().auth_session_key !== account.sessionKey ||
            sessionDoc.data().isExpired) {
            return { success: false, error: 'Invalid or expired session.' };
        }

        await clearManagingCookie();
        await setSessionCookies({
            accountId: account.accountId,
            sessionId: account.sessionId,
            sessionKey: account.sessionKey,
        }, expiresOn);
        
        return { success: true };
    } catch (error) {
        await logError('database', error, `switchActiveAccount: ${account.accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
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

export async function switchToPersonal() {
  try {
    await clearManagingCookie();
  } catch (error) {
    await logError('auth', error, `switchToPersonal`);
  }
}
