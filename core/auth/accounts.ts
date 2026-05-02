'use server';

import { cookieProvider } from '@/core/providers/cookies';
import type { StoredAccount } from '@/core/helpers/session';

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
