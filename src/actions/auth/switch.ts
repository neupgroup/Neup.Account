
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { cookies, headers } from 'next/headers';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import type { StoredAccount } from './session';

const SESSION_DURATION_DAYS = 30;

export async function getStoredAccounts(): Promise<StoredAccount[]> {
    const cookieStore = cookies();
    const accountsCookie = cookieStore.get('auth_accounts');
    if (accountsCookie?.value) {
        try {
            const accounts = JSON.parse(accountsCookie.value);
            if(Array.isArray(accounts)) {
                return accounts;
            }
        } catch (e) {
            return [];
        }
    }
    return [];
}

export async function getValidatedStoredAccounts(): Promise<StoredAccount[]> {
    const storedAccounts = await getStoredAccounts();
    if (storedAccounts.length === 0) {
        return [];
    }
    
    const validatedAccounts = await Promise.all(
        storedAccounts.map(async (account) => {
            if (account.expired) {
                return account;
            }
            // An account might not have a session ID if it was added improperly
            if (!account.sessionId) {
                return { ...account, expired: true };
            }
            try {
                const sessionRef = doc(db, 'session', account.sessionId);
                const sessionDoc = await getDoc(sessionRef);

                if (!sessionDoc.exists()) {
                    return { ...account, expired: true };
                }

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
                await logError('database', e, 'getValidatedStoredAccounts:validation_loop');
                return { ...account, expired: true };
            }
        })
    );
    
    return validatedAccounts;
}

export async function switchActiveAccount(account: StoredAccount) {
    if (account.expired) {
        return { success: false, error: 'Cannot switch to an expired session. Please sign in.' };
    }
    
    const cookieStore = cookies();
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

    try {
        // Validate the session on the server before setting cookies
        const sessionRef = doc(db, 'session', account.sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists() || 
            sessionDoc.data().accountId !== account.accountId ||
            sessionDoc.data().auth_session_key !== account.sessionKey ||
            sessionDoc.data().isExpired) {
            return { success: false, error: 'Invalid or expired session.' };
        }

        // Clear managing cookie when switching
        cookieStore.delete('auth_managing');
        
        // Set new active session cookies
        cookieStore.set('auth_account_id', account.accountId, cookieOptions);
        cookieStore.set('auth_session_id', account.sessionId, cookieOptions);
        cookieStore.set('auth_session_key', account.sessionKey, cookieOptions);
        
        await logActivity(account.accountId, `Switched to account: ${account.neupId}`);
        return { success: true };
    } catch (error) {
        await logError('database', error, `switchActiveAccount: ${account.accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function logoutStoredSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    const cookieStore = cookies();
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

        // Update the stored accounts cookie
        const existingAccountsCookie = cookieStore.get('auth_accounts');
        if (existingAccountsCookie?.value) {
            let allAccounts: StoredAccount[] = JSON.parse(existingAccountsCookie.value);
            if (Array.isArray(allAccounts)) {
                allAccounts = allAccounts.map(acc => {
                    if (acc.sessionId === sessionId) {
                        return { ...acc, expired: true };
                    }
                    return acc;
                });
                const longLivedCookieOptions = { path: '/', expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), sameSite: 'lax' as const, secure: true, httpOnly: true };
                cookieStore.set('auth_accounts', JSON.stringify(allAccounts), longLivedCookieOptions);
            }
        }
        return { success: true };
    } catch (error) {
        await logError('database', error, `logoutStoredSession: ${sessionId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function removeStoredAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    const cookieStore = cookies();
    try {
        const existingAccountsCookie = cookieStore.get('auth_accounts');
        if (existingAccountsCookie?.value) {
            let allAccounts: StoredAccount[] = JSON.parse(existingAccountsCookie.value);
            if (Array.isArray(allAccounts)) {
                const filteredAccounts = allAccounts.filter(acc => acc.accountId !== accountId);
                const longLivedCookieOptions = { path: '/', expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), sameSite: 'lax' as const, secure: true, httpOnly: true };
                cookieStore.set('auth_accounts', JSON.stringify(filteredAccounts), longLivedCookieOptions);
            }
        }
        await logActivity(accountId, 'Removed account from device', 'Success');
        return { success: true };
    } catch (error) {
        await logError('unknown', error, `removeStoredAccount: ${accountId}`);
        return { success: false, error: "Failed to remove account from device." };
    }
}
