

"use server";

import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc, getDoc, limit, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logActivity } from './log-actions';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { logError } from './logger';
import { redirect } from 'next/navigation';
import { getUserProfile, getUserNeupIds } from './user-actions';

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

export type BrandAccount = {
    id: string;
    name: string;
    logoUrl?: string;
    plan: string;
};


async function createAndSetSession(accountId: string, loginType: string, ipAddress: string, userAgent: string, geolocation?: string) {
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


async function isFirstUser() {
    const accountsCollection = collection(db, 'account');
    const accountsSnapshot = await getDocs(query(accountsCollection, limit(1)));
    return accountsSnapshot.empty;
}

const registerFormSchema = z.object({
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    gender: z.enum(["male", "female", "custom", "prefer_not_to_say"]),
    customGender: z.string().optional(),
    dob: z.string(),
    nationality: z.string().min(1),
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    agreement: z.boolean().refine(val => val, { message: "You must agree to the terms." }),
    geolocation: z.string().optional(),
});

export async function registerUser(data: z.infer<typeof registerFormSchema>) {
    const validation = registerFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { password, geolocation } = validation.data;
    const neupId = validation.data.neupId.toLowerCase();
    
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        const isAdmin = await isFirstUser();
        // The permission set name for an admin is 'admin', otherwise 'standard_user'.
        const permissionSetName = isAdmin ? 'admin' : 'standard_user';
        
        let finalGender = validation.data.gender;
        if (validation.data.gender === 'custom') {
            finalGender = `c.${validation.data.customGender?.trim() || 'custom'}`;
        }

        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const accountId = newAccountRef.id;
        
        batch.set(doc(db, 'account', accountId), { type: 'individual' });

        // Grant permissions by finding the permission set ID
        const permQuery = query(collection(db, 'permission'), where('name', '==', permissionSetName), limit(1));
        const permSnap = await getDocs(permQuery);
        
        if (!permSnap.empty) {
            const permId = permSnap.docs[0].id;
            const newPermitRef = doc(collection(db, 'permit'));
            batch.set(newPermitRef, {
                account_id: accountId,
                is_root: true,
                permission: [permId],
                restricted_permission: [],
                created_on: serverTimestamp(),
            });
        }


        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: accountId, is_primary: true });

        const hashedPassword = await bcrypt.hash(password, 10);
        batch.set(doc(db, 'auth_password', accountId), { pass: hashedPassword, passwordLastChanged: serverTimestamp() });
        
        const { password: _p, agreement: _a, gender, customGender, geolocation: _g, neupId: _n, ...profileData } = validation.data;
        batch.set(doc(db, "profile", accountId), { ...profileData, gender: finalGender, createdAt: serverTimestamp() });
        
        await batch.commit();
        
        await logActivity(accountId, 'User Registration', 'Success', ipAddress, undefined, geolocation);
        await createAndSetSession(accountId, 'Registration', ipAddress, userAgent, geolocation);

        return { success: true };
    } catch (error) {
        await logError('database', error, 'registerUser');
        return { success: false, error: 'An unexpected error occurred during registration.' };
    }
}

const loginFormSchema = z.object({
    neupId: z.string().min(1, "NeupID is required."),
    password: z.string().min(1, "Password is required."),
    geolocation: z.string().optional(),
});

export async function loginUser(data: z.infer<typeof loginFormSchema>) {
    const validation = loginFormSchema.safeParse(data);
    if (!validation.success) { return { success: false, error: "Invalid data provided." }; }
    
    const neupId = data.neupId.toLowerCase();
    const { password, geolocation } = validation.data;
    
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

    try {
        const neupidsRef = doc(db, 'neupid', neupId);
        const neupidsSnapshot = await getDoc(neupidsRef);

        if (!neupidsSnapshot.exists()) {
            await logActivity('unknown', `Login Attempt Failed for NeupID: ${neupId}`, 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        const accountId = neupidsSnapshot.data().for;
        const passRef = doc(db, 'auth_password', accountId);
        const passDoc = await getDoc(passRef);

        if (!passDoc.exists()) {
             await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Authentication data not found.' };
        }
        const isMatch = await bcrypt.compare(password, passDoc.data().pass);
        if (!isMatch) {
            await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        await logActivity(accountId, 'Login', 'Success', ipAddress, undefined, geolocation);
        await createAndSetSession(accountId, 'Password', ipAddress, userAgent, geolocation);

        return { success: true };
    } catch (error) {
        await logError('database', error, 'loginUser');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function logoutActiveSession() {
    const cookieStore = cookies();
    const sessionId = cookieStore.get('auth_session_id')?.value;
    const accountId = cookieStore.get('auth_account_id')?.value;
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';

    if (sessionId && accountId) {
        try {
            const sessionRef = doc(db, 'session', sessionId);
            await updateDoc(sessionRef, { isExpired: true });
            await logActivity(accountId, 'Signout', 'Success', ipAddress);

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

        } catch (error) {
            await logError('database', error, 'logoutActiveSession:updateDoc');
        }
    }
    
    cookieStore.delete('auth_account_id');
    cookieStore.delete('auth_session_id');
    cookieStore.delete('auth_session_key');
    cookieStore.delete('auth_managing');
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
        const startUrl = new URL('/auth/signin', 'http://localhost');
        startUrl.searchParams.set('error', 'session_expired');
        redirect(startUrl.toString().replace(startUrl.origin, ''));
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

export async function getTotalUsers() {
    try {
        const accountsCollection = collection(db, 'account');
        const snapshot = await getDocs(accountsCollection);
        return snapshot.size;
    } catch (error) {
        await logError('database', error, 'getTotalUsers');
        return 0;
    }
}

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
