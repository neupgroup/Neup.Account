

import { cookies } from 'next/headers';
import type { StoredAccount } from '@/core/auth/session';
import type { Session } from "@/core/auth/session";
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
        const parsedAccounts = await this.getJson<unknown[]>('auth_accounts', []);
        const allAccounts = Array.isArray(parsedAccounts)
            ? parsedAccounts
                .map((account: any) => {
                    const aid = account?.aid || account?.accountId;
                    if (!aid) return null;
                    return {
                        aid,
                        sid: account?.sid || account?.sessionId,
                        skey: account?.skey || account?.sessionKey,
                        def: account?.def === 1 ? 1 : 0,
                        nid: account?.nid || account?.neupId || '',
                        neupId: account?.nid || account?.neupId || '',
                    } as StoredAccount;
                })
                .filter(Boolean) as StoredAccount[]
            : [];

        const active = allAccounts.find(a => a.def === 1);
        const aid = active?.aid || '';
        const sid = active?.sid || '';
        const skey = active?.skey || '';

        const managingCookie = await this.get('managing');
        const managingAccountId = managingCookie || undefined;

        return {
            aid,
            sid,
            skey,
            jwt: undefined as string | undefined,
            accountId: aid,
            sessionId: sid,
            sessionKey: skey,
            managingAccountId,
            allAccounts,
        };
    }

    public async setSessionCookies(session: Session, expires: Date) {
        const aid = session.aid || session.accountId;
        const sid = session.sid || session.sessionId;
        const skey = session.skey || session.sessionKey;

        if (!aid || !sid || !skey) {
            throw new Error('Missing session values for cookie set.');
        }

        const existing = await this.getJson<unknown[]>('auth_accounts', []);
        const accounts = Array.isArray(existing) ? existing : [];

        const others = accounts
            .map((a: any) => ({ ...a, def: 0 }))
            .filter((a: any) => (a?.aid || a?.accountId) !== aid);

        const existingEntry = accounts.find((a: any) => (a?.aid || a?.accountId) === aid) as any;

        const current = {
            aid,
            sid,
            skey,
            def: 1,
            nid: existingEntry?.nid || '',
        };

        await this.setJson('auth_accounts', [...others, current], {
            ...COOKIE_OPTIONS,
            expires,
        });
    }

    public async setStoredAccountsCookie(accounts: StoredAccount[]) {
        const normalized = accounts.map((a) => ({
            aid: a.aid,
            sid: a.sid,
            skey: a.skey,
            def: a.def ?? 0,
            nid: a.nid || a.neupId || '',
        }));

        await this.setJson('auth_accounts', normalized, LONG_LIVED_COOKIE_OPTIONS);
    }

    public async setManagingCookie(accountId: string) {
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        await this.set('managing', accountId, { ...COOKIE_OPTIONS, expires });
    }

    public async clearManagingCookie() {
        await this.del('managing');
    }

    public async clearSessionCookies() {
        // Mark the active account as def:0 and strip its session keys
        const existing = await this.getJson<unknown[]>('auth_accounts', []);
        if (Array.isArray(existing) && existing.length > 0) {
            const updated = existing.map((a: any) => {
                if (a?.def === 1) {
                    const { sid: _s, skey: _sk, ...rest } = a;
                    return { ...rest, def: 0 };
                }
                return a;
            });
            await this.setJson('auth_accounts', updated, LONG_LIVED_COOKIE_OPTIONS);
        }

        await this.del('managing');

        // Remove all legacy individual session cookies
        await this.del('auth_aid');
        await this.del('auth_sid');
        await this.del('auth_skey');
        await this.del('auth_jwt');
        await this.del('auth_account_id');
        await this.del('auth_session_id');
        await this.del('auth_session_key');
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
export async function setManagingCookie(accountId: string) {
    return authCookies.setManagingCookie(accountId);
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
