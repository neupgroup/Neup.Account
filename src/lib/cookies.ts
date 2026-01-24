

'use server';

import { cookies, headers } from 'next/headers';
import type { StoredAccount } from '@/types';
import type { Session } from "@/lib/auth-actions";


/**
 * Base options for all authentication-related cookies.
 * Sets path, SameSite, Secure, and HttpOnly attributes.
 * Secure flag is set to true only in production to allow localhost development.
 */
const COOKIE_OPTIONS = {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
};

async function getSecureAttribute() {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) return false;

    try {
        const headersList = await headers();
        const host = headersList.get('host') || '';
        if (host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.')) {
            return false;
        }
    } catch (e) {
        // Fallback or ignore if headers() not available
    }
    return true;
}


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
    const isSecure = await getSecureAttribute();
    const options = { ...COOKIE_OPTIONS, expires, secure: isSecure };

    cookieStore.set('auth_account_id', session.accountId, options);
    cookieStore.set('auth_session_id', session.sessionId, options);
    cookieStore.set('auth_session_key', session.sessionKey, options);
}


/**
 * Sets the long-lived cookie for storing all known accounts on the device.
 */
export async function setStoredAccountsCookie(accounts: StoredAccount[]) {
    const cookieStore = await cookies();
    const isSecure = await getSecureAttribute();
    const expires = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    cookieStore.set('auth_accounts', JSON.stringify(accounts), { ...COOKIE_OPTIONS, expires, secure: isSecure });
}


/**
 * Sets the cookie to indicate which brand/dependent account is being managed.
 */
export async function setManagingCookie(value: string, expires: Date) {
    const cookieStore = await cookies();
    const isSecure = await getSecureAttribute();
    cookieStore.set('auth_managing', value, { ...COOKIE_OPTIONS, expires, secure: isSecure });
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

    // Also remove old, unnecessary cookies if they exist
    cookieStore.delete('auth_permit');
    cookieStore.delete('profile_name');
    cookieStore.delete('profile_neupid');
}
