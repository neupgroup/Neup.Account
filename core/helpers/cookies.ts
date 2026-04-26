

import { cookies } from 'next/headers';
import type { StoredAccount } from '@/core/helpers/session';
import type { Session } from "@/core/helpers/auth-actions";
import { Singleton } from '@/core/interface/singleton';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieSetOptions = Parameters<CookieStore['set']>[2];


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


export class AuthCookiesHelper extends Singleton {
    public constructor() {
        super();
    }

    public static getInstance(): AuthCookiesHelper {
        return this.instanceFor<AuthCookiesHelper>();
    }

    private async getStore() {
        return cookies();
    }

    public async get(name: string) {
        const cookieStore = await this.getStore();
        return cookieStore.get(name)?.value;
    }

    public async set(name: string, value: string, options?: CookieSetOptions) {
        const cookieStore = await this.getStore();
        if (options) {
            cookieStore.set(name, value, options);
            return;
        }

        cookieStore.set(name, value);
    }

    public async del(name: string) {
        const cookieStore = await this.getStore();
        cookieStore.delete(name);
    }

    public async getJson<T>(name: string, fallback: T): Promise<T> {
        const raw = await this.get(name);
        if (!raw) {
            return fallback;
        }

        try {
            return JSON.parse(raw) as T;
        } catch {
            return fallback;
        }
    }

    public async setJson(name: string, value: unknown, options?: CookieSetOptions) {
        await this.set(name, JSON.stringify(value), options);
    }

    public async getSessionCookies() {
        const aid = (await this.get('auth_aid')) || (await this.get('auth_account_id'));
        const sid = (await this.get('auth_sid')) || (await this.get('auth_session_id'));
        const skey = (await this.get('auth_skey')) || (await this.get('auth_session_key'));
        const jwt = await this.get('auth_jwt');
        const managingCookie = await this.get('auth_managing');

        const parsedAccounts = await this.getJson<unknown[]>('auth_accounts', []);
        const allAccounts = Array.isArray(parsedAccounts)
            ? parsedAccounts
                .map((account: any) => {
                    const normalizedAid = account?.aid || account?.accountId;
                    if (!normalizedAid) return null;

                    const normalizedSid = account?.sid || account?.sessionId;
                    const normalizedSkey = account?.skey || account?.sessionKey;

                    return {
                        aid: normalizedAid,
                        sid: normalizedSid,
                        skey: normalizedSkey,
                        accountId: normalizedAid,
                        sessionId: normalizedSid,
                        sessionKey: normalizedSkey,
                        neupId: account?.neupId || '',
                        expired: Boolean(account?.expired),
                        active: Boolean(account?.active),
                    } as StoredAccount;
                })
                .filter(Boolean) as StoredAccount[]
            : [];

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

    public async setSessionCookies(session: Session, expires: Date) {
        const options = { ...COOKIE_OPTIONS, expires };

        const aid = session.aid || session.accountId;
        const sid = session.sid || session.sessionId;
        const skey = session.skey || session.sessionKey;

        if (!aid || !sid || !skey) {
            throw new Error('Missing session values for cookie set.');
        }

        await this.set('auth_aid', aid, options);
        await this.set('auth_sid', sid, options);
        await this.set('auth_skey', skey, options);

        if (session.jwt) {
            await this.set('auth_jwt', session.jwt, options);
        } else {
            await this.del('auth_jwt');
        }

        // Remove legacy cookie keys after writing the new keys.
        await this.del('auth_account_id');
        await this.del('auth_session_id');
        await this.del('auth_session_key');
    }

    public async setStoredAccountsCookie(accounts: StoredAccount[]) {
        const normalizedAccounts = accounts.map((account) => ({
            aid: account.aid || account.accountId,
            sid: account.sid || account.sessionId,
            skey: account.skey || account.sessionKey,
            neupId: account.neupId,
            expired: account.expired,
            active: account.active,
        }));

        await this.setJson('auth_accounts', normalizedAccounts, LONG_LIVED_COOKIE_OPTIONS);
    }

    public async setManagingCookie(value: string, expires: Date) {
        await this.set('auth_managing', value, { ...COOKIE_OPTIONS, expires });
    }

    public async clearManagingCookie() {
        await this.del('auth_managing');
    }

    public async clearSessionCookies() {
        await this.del('auth_aid');
        await this.del('auth_sid');
        await this.del('auth_skey');
        await this.del('auth_jwt');
        await this.del('auth_account_id');
        await this.del('auth_session_id');
        await this.del('auth_session_key');
        await this.del('auth_managing');

        // Also remove old, unnecessary cookies if they exist.
        await this.del('auth_permit');
        await this.del('profile_name');
        await this.del('profile_neupid');
    }
}

// Shared singleton used by all server helpers and services.
export const authCookies = AuthCookiesHelper.getInstance();


/**
 * Retrieves all authentication-related cookies.
 */
export async function getSessionCookies() {
    return authCookies.getSessionCookies();
}


/**
 * Sets the main session cookies.
 */
export async function setSessionCookies(session: Session, expires: Date) {
    return authCookies.setSessionCookies(session, expires);
}


/**
 * Sets the long-lived cookie for storing all known accounts on the device.
 */
export async function setStoredAccountsCookie(accounts: StoredAccount[]) {
    return authCookies.setStoredAccountsCookie(accounts);
}


/**
 * Sets the cookie to indicate which brand/dependent account is being managed.
 */
export async function setManagingCookie(value: string, expires: Date) {
    return authCookies.setManagingCookie(value, expires);
}


/**
 * Clears the managing cookie to return to the personal account view.
 */
export async function clearManagingCookie() {
    return authCookies.clearManagingCookie();
}


/**
 * Clears all active session cookies, effectively logging the user out.
 */
export async function clearSessionCookies() {
    return authCookies.clearSessionCookies();
}
