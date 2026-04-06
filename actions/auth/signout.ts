'use server';

import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { logError } from '@/lib/logger';
import { getSessionCookies, clearSessionCookies, setStoredAccountsCookie } from '@/lib/cookies';
import { makeNotification } from '@/actions/notifications';

export async function logoutActiveSession() {
    const { sessionId, accountId, allAccounts } = await getSessionCookies();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';

    if (sessionId && accountId) {
        try {
            await prisma.$transaction([
                prisma.session.update({
                    where: { id: sessionId },
                    data: { isExpired: true }
                }),
                prisma.appSession.deleteMany({
                    where: { sessionId: sessionId }
                })
            ]);
            await logActivity(accountId, 'Signout', 'Success', ipAddress);
            await makeNotification({
                recipient_id: accountId,
                action: 'informative.logout',
                message: 'Your active session was signed out.',
            });

            if (allAccounts.length > 0) {
                const updatedAccounts = allAccounts.map(acc => {
                    if (acc.sessionId === sessionId) {
                        // Remove session details for the signed out account
                        return {
                            ...acc,
                            sessionId: undefined,
                            sessionKey: undefined,
                            expired: true,
                        };
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
