
'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { logActivity } from '@/lib/log-actions';
import { cookies, headers } from 'next/headers';
import type { StoredAccount } from './session';
import { logError } from '@/lib/logger';

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
