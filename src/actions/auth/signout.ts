'use server';

import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { logError } from '@/lib/logger';
import { getSessionCookies, clearSessionCookies, setStoredAccountsCookie } from '@/lib/cookies';

export async function logoutActiveSession() {
    const { sessionId, accountId, allAccounts } = await getSessionCookies();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';

    if (sessionId && accountId) {
        try {
            await prisma.session.update({
                where: { id: sessionId },
                data: { isExpired: true }
            });
            await logActivity(accountId, 'Signout', 'Success', ipAddress);

            if (allAccounts.length > 0) {
                const updatedAccounts = allAccounts.map(acc => {
                    if (acc.sessionId === sessionId) {
                        // Remove session details for the signed out account
                        const { sessionId: _, sessionKey: __, ...rest } = acc;
                        return { ...rest, expired: true };
                    }
                    return acc;
                });
                await setStoredAccountsCookie(updatedAccounts);
            }

        } catch (error) {
            await logError('database', error, 'logoutActiveSession:updateDoc');
        }
    }
    
    await clearSessionCookies();
}
