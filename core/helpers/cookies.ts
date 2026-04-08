

'use server';

import { cookies } from 'next/headers';
import type { StoredAccount } from '@/types';
import type { Session } from "@/core/helpers/auth-actions";


/**
 * Base options for all authentication-related cookies.
 * Sets path, SameSite, Secure, and HttpOnly attributes.
 * Secure and HttpOnly flags are set to true unconditionally for ALL environments (Dev & Prod).
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
    const aid = cookieStore.get('auth_aid')?.value || cookieStore.get('auth_account_id')?.value;
    const sid = cookieStore.get('auth_sid')?.value || cookieStore.get('auth_session_id')?.value;
    const skey = cookieStore.get('auth_skey')?.value || cookieStore.get('auth_session_key')?.value;
    const jwt = cookieStore.get('auth_jwt')?.value;
    const managingCookie = cookieStore.get('auth_managing')?.value;
    const allAccountsCookie = cookieStore.get('auth_accounts');

    let allAccounts: StoredAccount[] = [];
    if (allAccountsCookie?.value) {
        try {
            const parsed = JSON.parse(allAccountsCookie.value);
            if (!Array.isArray(parsed)) {
                allAccounts = [];
            } else {
                allAccounts = parsed
                    .map((account: any) => {
                        const normalizedAid = account?.aid || account?.accountId;
                        if (!normalizedAid) return null;

                        return {
                            aid: normalizedAid,
                            sid: account?.sid || account?.sessionId,
                            skey: account?.skey || account?.sessionKey,
                            neupId: account?.neupId || '',
                            expired: Boolean(account?.expired),
                            active: Boolean(account?.active),
                        } as StoredAccount;
                    })
                    .filter(Boolean) as StoredAccount[];
            }
        } catch (e) {
            allAccounts = [];
        }
    }

    let managingAccountId: string | undefined = undefined;
    if (managingCookie && (managingCookie.startsWith('brand.') || managingCookie.startsWith('dependent.') || managingCookie.startsWith('delegated.'))) {
        managingAccountId = managingCookie.split('.')[1];
    }

    return {
        aid,
        sid,
        skey,
        jwt,
        accountId: aid,
        sessionId: sid,
        sessionKey: skey,
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

    const aid = session.aid || session.accountId;
    const sid = session.sid || session.sessionId;
    const skey = session.skey || session.sessionKey;

    if (!aid || !sid || !skey) {
        throw new Error('Missing session values for cookie set.');
    }

    cookieStore.set('auth_aid', aid, options);
    cookieStore.set('auth_sid', sid, options);
    cookieStore.set('auth_skey', skey, options);

    if (session.jwt) {
        cookieStore.set('auth_jwt', session.jwt, options);
    } else {
        cookieStore.delete('auth_jwt');
    }

    // Remove legacy cookie keys after writing the new keys.
    cookieStore.delete('auth_account_id');
    cookieStore.delete('auth_session_id');
    cookieStore.delete('auth_session_key');
}


/**
 * Sets the long-lived cookie for storing all known accounts on the device.
 */
export async function setStoredAccountsCookie(accounts: StoredAccount[]) {
    const cookieStore = await cookies();
    const normalizedAccounts = accounts.map((account) => ({
        aid: account.aid || account.accountId,
        sid: account.sid || account.sessionId,
        skey: account.skey || account.sessionKey,
        neupId: account.neupId,
        expired: account.expired,
        active: account.active,
    }));

    cookieStore.set('auth_accounts', JSON.stringify(normalizedAccounts), LONG_LIVED_COOKIE_OPTIONS);
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
    cookieStore.delete('auth_aid');
    cookieStore.delete('auth_sid');
    cookieStore.delete('auth_skey');
    cookieStore.delete('auth_jwt');
    cookieStore.delete('auth_account_id');
    cookieStore.delete('auth_session_id');
    cookieStore.delete('auth_session_key');
    cookieStore.delete('auth_managing');

    // Also remove old, unnecessary cookies if they exist
    cookieStore.delete('auth_permit');
    cookieStore.delete('profile_name');
    cookieStore.delete('profile_neupid');
}
