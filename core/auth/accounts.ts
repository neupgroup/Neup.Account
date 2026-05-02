'use server';

// Provides direct read/write access to the auth_accounts cookie array.
// These are thin, focused functions — they do not validate sessions against the DB.
// Use getValidatedStoredAccounts() from session.ts if you need DB validation.

import { cookieProvider } from '@/core/providers/cookies';
import type { StoredAccount } from '@/core/auth/session';

// 1 year — matches the long-lived cookie expiry used across the auth system
const ACCOUNTS_COOKIE_EXPIRY = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
};

// Shared cookie options for the auth_accounts array
const ACCOUNTS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
};

// Reads and parses the auth_accounts cookie, normalizing legacy field names.
// Returns an empty array if the cookie is missing or malformed.
export async function getAccounts(): Promise<StoredAccount[]> {
    const raw = await cookieProvider.getCookie('auth_accounts');
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .map((a: any) => {
                const aid = a?.aid || a?.accountId;
                if (!aid) return null;
                return {
                    aid,
                    sid: a?.sid || a?.sessionId,
                    skey: a?.skey || a?.sessionKey,
                    def: a?.def === 1 ? 1 : 0,
                    nid: a?.nid || a?.neupId || '',
                    neupId: a?.nid || a?.neupId || '',
                } as StoredAccount;
            })
            .filter(Boolean) as StoredAccount[];
    } catch {
        return [];
    }
}

// Returns the account with def === 1, or null if no active account is set.
export async function getActiveAccount(): Promise<StoredAccount | null> {
    const accounts = await getAccounts();
    return accounts.find(a => a.def === 1) ?? null;
}

// Adds a new account to the auth_accounts cookie and marks it as active (def: 1).
// Demotes all other accounts to def: 0 and removes any previous entry for the same aid.
export async function addAccount(aid: string, sid: string, skey: string, nid: string): Promise<void> {
    const existing = await getAccounts();

    const others = existing
        .map(a => ({ ...a, def: 0 as const }))
        .filter(a => a.aid !== aid);

    const newAccount: StoredAccount = { aid, sid, skey, def: 1, nid, neupId: nid };

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify([...others, newAccount]), {
        ...ACCOUNTS_COOKIE_OPTIONS,
        expires: ACCOUNTS_COOKIE_EXPIRY(),
    });
}

// Sets def: 1 on the account matching the given aid or array index, and def: 0 on all others.
// Accepts either an aid string or a numeric index into the accounts array.
export async function updateDefaultAccount(identifier: string | number): Promise<void> {
    const existing = await getAccounts();

    const updated = existing.map((a, index) => {
        const isTarget = typeof identifier === 'number'
            ? index === identifier
            : a.aid === identifier;
        return { ...a, def: (isTarget ? 1 : 0) as 0 | 1 };
    });

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify(updated), {
        ...ACCOUNTS_COOKIE_OPTIONS,
        expires: ACCOUNTS_COOKIE_EXPIRY(),
    });
}

// Removes all account entries that are missing aid, sid, or skey.
// Use this to prune incomplete or logged-out accounts from the cookie.
export async function cleanAccounts(): Promise<void> {
    const existing = await getAccounts();

    const cleaned = existing.filter(a => a.aid && a.sid && a.skey);

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify(cleaned), {
        ...ACCOUNTS_COOKIE_OPTIONS,
        expires: ACCOUNTS_COOKIE_EXPIRY(),
    });
}
