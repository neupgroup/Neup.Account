'use server';

import prisma from '@/core/helpers/prisma';
import { logActivity } from '@/core/helpers/log-actions';
import { headers } from 'next/headers';
import { logError } from '@/core/helpers/logger';
import { getSessionCookies, clearSessionCookies, setStoredAccountsCookie } from '@/core/helpers/cookies';
import { expireSession } from './expireSession';

export async function logoutActiveSession() {
    const { sid, aid, allAccounts } = await getSessionCookies();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';

    if (sid && aid) {
        try {
            const expireResult = await expireSession({
                aid,
                sid,
                skey: allAccounts.find((acc) => acc.sid === sid)?.skey || '',
            });

            if (!expireResult.success) {
                await logError('auth', expireResult.error || 'Unknown error', 'logoutActiveSession:expireSession');
            }

            await prisma.appSession.deleteMany({
                where: { sessionId: sid }
            });
            await logActivity(aid, 'Signout', 'Success', ipAddress);

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
