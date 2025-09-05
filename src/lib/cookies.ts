
'use server';

import { cookies } from 'next/headers';
import type { StoredAccount } from '@/types';
import {Session} from "@/lib/auth-actions";


/**
 * Base options for all authentication-related cookies.
 * Sets path, SameSite, Secure, and HttpOnly attributes.
 */
const COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
    httpOnly: true,
};


/**
 * Options for cookies that should persist for a long time.
 * Simply extends the base COOKIE_OPTIONS with a 1-year expiration.
 */
const LONG_LIVED_COOKIE_OPTIONS = {
    ...COOKIE_OPTIONS,
    expires: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
};


/**
 * Retrieves all authentication-related cookies.
 */
export async function getSessionCookies() {
    const cookieStore = await cookies();
    const accountId = cookieStore.get('auth_account_id')?.value;
    const sessionId = cookieStore.get('auth_session_id')?.value;
    const sessionKey = cookieStore.get('auth_session_key')?.value;
    const managingCookie = cookieStore.get('auth_managing')?.value;
    const allAccountsCookie = cookieStore.get('auth_accounts');
    
    let allAccounts: StoredAccount[] = [];
    if (allAccountsCookie?.value) {
        try {
            allAccounts = JSON.parse(allAccountsCookie.value);
            if (!Array.isArray(allAccounts)) allAccounts = [];
        } catch (e) {
            allAccounts = [];
        }
    }

    let managingAccountId: string | undefined = undefined;
    if (managingCookie && (managingCookie.startsWith('brand.') || managingCookie.startsWith('dependent.'))) {
        managingAccountId = managingCookie.split('.')[1];
    }
    
    return {
        accountId,
        sessionId,
        sessionKey,
        managingAccountId,
        allAccounts,
    };
}


/**
 * Sets the main session cookies.
 */
export async function setSessionCookies(session: Session, expires: Date) {
    const cookieStore = await cookies();
    const options = { ...COOKIE_OPTIONS, expires };

    cookieStore.set('auth_account_id', session.accountId, options);
    cookieStore.set('auth_session_id', session.sessionId, options);
    cookieStore.set('auth_session_key', session.sessionKey, options);
}


/**
 * Sets the long-lived cookie for storing all known accounts on the device.
 */
export async function setStoredAccountsCookie(accounts: StoredAccount[]) {
    const cookieStore = await cookies();
    cookieStore.set('auth_accounts', JSON.stringify(accounts), LONG_LIVED_COOKIE_OPTIONS);
}


/**
 * Sets the cookie to indicate which brand/dependent account is being managed.
 */
export async function setManagingCookie(value: string, expires: Date) {
    const cookieStore = await cookies();
    cookieStore.set('auth_managing', value, { ...COOKIE_OPTIONS, expires });
}


/**
 * Clears the managing cookie to return to the personal account view.
 */
export async function clearManagingCookie() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_managing');
}


/**
 * Clears all active session cookies, effectively logging the user out.
 */
export async function clearSessionCookies() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_account_id');
    cookieStore.delete('auth_session_id');
    cookieStore.delete('auth_session_key');
    cookieStore.delete('auth_managing');
}
