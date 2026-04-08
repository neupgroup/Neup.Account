'use server';

import prisma from '@/core/helpers/prisma';
import { logActivity } from '@/core/helpers/log-actions';
import { headers } from 'next/headers';
import { logError } from '@/core/helpers/logger';
import { getSessionCookies, clearSessionCookies, setStoredAccountsCookie } from '@/core/helpers/cookies';
import { makeNotification } from '@/services/notifications';

export async function logoutActiveSession() {
    const { sid, aid, allAccounts } = await getSessionCookies();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';

    if (sid && aid) {
        try {
            await prisma.$transaction([
                prisma.session.update({
                    where: { id: sid },
                    data: { isExpired: true }
                }),
                prisma.appSession.deleteMany({
                    where: { sessionId: sid }
                })
            ]);
            await logActivity(aid, 'Signout', 'Success', ipAddress);
            await makeNotification({
                recipient_id: aid,
                action: 'informative.logout',
                message: 'Your active session was signed out.',
            });

            if (allAccounts.length > 0) {
                const updatedAccounts = allAccounts.map(acc => {
                    if (acc.sid === sid) {
                        // Remove session details for the signed out account
                        return {
                            ...acc,
                            sid: undefined,
                            skey: undefined,
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
