'use server';

import prisma from '@/lib/prisma';
import { getActiveAccountId, getActiveSession } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import type { Session } from '@/types';

export async function getUserSessions(): Promise<Session[]> {
    try {
        const accountId = await getActiveAccountId();
        if (!accountId) {
            return [];
        }

        const sessions = await prisma.session.findMany({
            where: {
                accountId: accountId,
                isExpired: false
            },
            orderBy: {
                lastLoggedIn: 'desc'
            }
        });
        
        type SessionInternal = Session & { rawLastLoggedIn: Date };

        const formattedSessions: SessionInternal[] = sessions.map(session => {
            return {
                id: session.id,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
                lastLoggedIn: session.lastLoggedIn.toLocaleString(),
                loginType: session.loginType,
                geolocation: session.geolocation || undefined,
                rawLastLoggedIn: session.lastLoggedIn
            };
        });

        // This is a type-only change, so we can cast it.
        return formattedSessions as unknown as Session[];
        
    } catch (error) {
        await logError('database', error, `getUserSessions`);
        return [];
    }
}


export async function logoutSessionById(sessionId: string): Promise<{ success: boolean, error?: string }> {
    if (!sessionId) {
        return { success: false, error: "Session ID is required." };
    }
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
        
        const accountId = await getActiveAccountId();
        if (accountId) {
            await logActivity(accountId, `Remote Logout of Session ${sessionId}`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, `logoutSessionById: ${sessionId}`);
        return { success: false, error: "Failed to log out session." };
    }
}

export async function logoutAllOtherSessions(): Promise<{ success: boolean, error?: string }> {
    try {
        const currentSession = await getActiveSession();
        if (!currentSession) {
            return { success: false, error: "No active session found." };
        }
        const { accountId, sessionId: currentSessionId } = currentSession;

        const result = await prisma.$transaction(async (tx) => {
            // 1. Get all other session IDs
            const otherSessions = await tx.session.findMany({
                where: {
                    accountId: accountId,
                    isExpired: false,
                    id: { not: currentSessionId }
                },
                select: { id: true }
            });
            const otherSessionIds = otherSessions.map(s => s.id);

            // 2. Expire all other sessions
            const updateResult = await tx.session.updateMany({
                where: {
                    id: { in: otherSessionIds }
                },
                data: { isExpired: true }
            });

            // 3. Delete all AppSessions for these sessions
            await tx.appSession.deleteMany({
                where: {
                    sessionId: { in: otherSessionIds }
                }
            });

            return updateResult;
        });

        const sessionsLoggedOut = result.count;

        if (sessionsLoggedOut > 0) {
            await logActivity(accountId, `Remotely logged out of ${sessionsLoggedOut} other sessions.`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, 'logoutAllOtherSessions');
        return { success: false, error: "Failed to log out other sessions." };
    }
}
