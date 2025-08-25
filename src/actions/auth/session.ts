
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, limit, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { logError } from '@/lib/logger';
import { redirect } from 'next/navigation';
import { getUserNeupIds } from '@/lib/user-actions';

const SESSION_DURATION_DAYS = 30;

export type Session = {
    auth_account_id: string;
    auth_session_id: string;
    auth_session_key: string;
};

export type StoredAccount = {
    accountId: string;
    sessionId: string;
    sessionKey: string;
    expired: boolean;
    neupId?: string; // Add neupId to the type
};

export async function createAndSetSession(accountId: string, loginType: string, ipAddress: string, userAgent: string, geolocation?: string) {
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
        auth_account_id: accountId,
        auth_session_id: newSessionDocRef.id,
        auth_session_key: sessionKey,
    };
    
    const [neupIds] = await Promise.all([getUserNeupIds(accountId)]);
    const primaryNeupId = neupIds[0];

    const newStoredAccount: StoredAccount = {
        accountId: accountId,
        sessionId: newSessionDocRef.id,
        sessionKey: sessionKey,
        expired: false,
        neupId: primaryNeupId,
    };

    const cookieStore = await cookies();
    const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

    // Set active session cookies
    cookieStore.set('auth_account_id', newSession.auth_account_id, cookieOptions);
    cookieStore.set('auth_session_id', newSession.auth_session_id, cookieOptions);
    cookieStore.set('auth_session_key', newSession.auth_session_key, cookieOptions);
    
    // Update or add to the list of accounts
    const existingAccountsCookie = cookieStore.get('auth_accounts');
    let allAccounts: StoredAccount[] = [];
    if (existingAccountsCookie?.value) {
        try {
            allAccounts = JSON.parse(existingAccountsCookie.value);
            if (!Array.isArray(allAccounts)) allAccounts = [];
        } catch (e) {
            allAccounts = [];
        }
    }

    let accountFound = false;
    allAccounts = allAccounts.map(acc => {
        if (acc.accountId === accountId) {
            accountFound = true;
            return newStoredAccount;
        }
        return acc;
    });
    
    if (!accountFound) {
        allAccounts.push(newStoredAccount);
    }

    cookieStore.set('auth_accounts', JSON.stringify(allAccounts), { ...cookieOptions, expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) });
}

export async function getActiveSessionDetails(): Promise<Session | null> {
    const cookieStore = await cookies();
    const accountId = cookieStore.get('auth_account_id')?.value;
    const sessionId = cookieStore.get('auth_session_id')?.value;
    const sessionKey = cookieStore.get('auth_session_key')?.value;

    if (!accountId || !sessionId || !sessionKey) {
        return null;
    }

    try {
        const sessionRef = doc(db, 'session', sessionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
            return null;
        }

        const sessionData = sessionDoc.data();
        const dbExpiresOn = sessionData.expiresOn?.toDate();

        const isInvalid =
            !dbExpiresOn ||
            dbExpiresOn < new Date() ||
            sessionData.isExpired ||
            sessionData.accountId !== accountId ||
            sessionData.auth_session_key !== sessionKey;

        if (isInvalid) {
            return null;
        }
        
        return {
            auth_account_id: sessionData.accountId,
            auth_session_id: sessionId,
            auth_session_key: sessionData.auth_session_key,
        };

    } catch (error) {
        await logError('database', error, 'getActiveSessionDetails');
        return null;
    }
}

export async function hasActiveSessionCookies(): Promise<boolean> {
    const cookieStore = await cookies();
    const accountId = cookieStore.get('auth_account_id')?.value;
    const sessionId = cookieStore.get('auth_session_id')?.value;
    const sessionKey = cookieStore.get('auth_session_key')?.value;

    return !!(accountId && sessionId && sessionKey);
}

export async function validateCurrentSession() {
    const session = await getActiveSessionDetails();
    if (!session) {
        const url = new URL('/auth/signin', 'http://localhost'); // Base URL doesn't matter here
        url.searchParams.set('error', 'session_expired');
        redirect(url.pathname + url.search);
    }

    // Check for service block
    try {
        const accountRef = doc(db, 'account', session.auth_account_id);
        const accountDoc = await getDoc(accountRef);
        if (accountDoc.exists()) {
            const blockData = accountDoc.data().block;
            if (blockData && blockData.status) {
                 if (blockData.is_permanent) {
                    redirect('/blocked');
                 } else if (blockData.until) {
                    const blockedUntil = blockData.until.toDate();
                    if (blockedUntil > new Date()) {
                        redirect('/blocked');
                    }
                 }
            }
        }
    } catch(e) {
        await logError('database', e, `validateCurrentSession:blockCheck`);
        // Fail open if check fails, but log the error.
    }


    return session;
}

export async function getActiveAccountId() {
    const cookieStore = cookies();
    const managingCookie = cookieStore.get('auth_managing')?.value;

    if (managingCookie && (managingCookie.startsWith('brand.') || managingCookie.startsWith('dependent.'))) {
        return managingCookie.split('.')[1];
    }
    
    const session = await getActiveSessionDetails();
    return session?.auth_account_id || null;
}

export async function getPersonalAccountId() {
    const session = await getActiveSessionDetails();
    return session?.auth_account_id || null;
}

export async function validateNeupId(neupId: string): Promise<{ success: boolean; error?: string }> {
    if (!neupId || neupId.length < 3) {
        return { success: false, error: "NeupID must be at least 3 characters." };
    }

    try {
        const neupidRef = doc(db, 'neupid', neupId);
        const neupidDoc = await getDoc(neupidRef);

        if (!neupidDoc.exists()) {
            return { success: false, error: "NeupID not found." };
        }

        const accountId = neupidDoc.data().for;
        const accountRef = doc(db, 'account', accountId);
        const accountDoc = await getDoc(accountRef);

        if (!accountDoc.exists()) {
            return { success: false, error: "Associated account does not exist." };
        }

        const accountData = accountDoc.data();
        if (accountData.type === 'brand' || accountData.type === 'branch') {
             return { success: false, error: "Brand accounts can't be signed in." };
        }

        if (accountData.block?.status) {
             const block = accountData.block;
             if (block.is_permanent || (block.until && block.until.toDate() > new Date())) {
                return { success: false, error: "This account has been blocked." };
             }
        }

        return { success: true };

    } catch(e) {
        await logError('database', e, `validateNeupId for ${neupId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function checkNeupIdAvailability(neupId: string): Promise<{ available: boolean }> {
    const lowerNeupId = neupId.toLowerCase();
    if (!lowerNeupId || lowerNeupId.length < 3) {
        return { available: false };
    }
    try {
        const neupidsRef = collection(db, 'neupid');
        const docRef = doc(neupidsRef, lowerNeupId);
        const docSnap = await getDoc(docRef);
        return { available: !docSnap.exists() };
    } catch (error) {
        await logError('database', error, `checkNeupIdAvailability: ${lowerNeupId}`);
        // To be safe, report as unavailable on error
        return { available: false };
    }
}
