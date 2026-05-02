'use server';

import { cookieProvider } from '@/core/providers/cookies';
import type { StoredAccount } from '@/core/auth/session';

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

export async function getActiveAccount(): Promise<StoredAccount | null> {
    const accounts = await getAccounts();
    return accounts.find(a => a.def === 1) ?? null;
}

export async function addAccount(aid: string, sid: string, skey: string, nid: string): Promise<void> {
    const existing = await getAccounts();

    const others = existing
        .map(a => ({ ...a, def: 0 as const }))
        .filter(a => a.aid !== aid);

    const newAccount: StoredAccount = { aid, sid, skey, def: 1, nid, neupId: nid };

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify([...others, newAccount]), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expires,
    });
}

export async function updateDefaultAccount(identifier: string | number): Promise<void> {
    const existing = await getAccounts();

    const updated = existing.map((a, index) => {
        const isTarget = typeof identifier === 'number'
            ? index === identifier
            : a.aid === identifier;
        return { ...a, def: (isTarget ? 1 : 0) as 0 | 1 };
    });

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify(updated), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expires,
    });
}

export async function cleanAccounts(): Promise<void> {
    const existing = await getAccounts();

    const cleaned = existing.filter(a => a.aid && a.sid && a.skey);

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);

    await cookieProvider.setCookieRaw('auth_accounts', JSON.stringify(cleaned), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        expires,
    });
}


