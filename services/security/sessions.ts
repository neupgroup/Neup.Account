'use server';

import prisma from '@/core/helpers/prisma';
import { getActiveAccountId, getActiveSession } from '@/core/helpers/auth-actions';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';

export type ManagedSession = {
    id: string;
    ipAddress: string;
    userAgent: string;
    lastLoggedIn: string;
    loginType: string;
    geolocation?: string;
};

/**
 * Function getUserSessions.
 */
export async function getUserSessions(): Promise<ManagedSession[]> {
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
        
        const formattedSessions: ManagedSession[] = sessions.map(session => {
            return {
                id: session.id,
                ipAddress: session.ipAddress || 'Unknown IP',
                userAgent: session.userAgent || 'Unknown Device',
                lastLoggedIn: session.lastLoggedIn.toLocaleString(),
                loginType: session.loginType || 'unknown',
                geolocation: session.geolocation || undefined,
            };
        });

        return formattedSessions;
        
    } catch (error) {
        await logError('database', error, `getUserSessions`);
        return [];
    }
}


/**
 * Function logoutSessionById.
 */
export async function logoutSessionById(sessionId: string): Promise<{ success: boolean, error?: string }> {
    if (!sessionId) {
        return { success: false, error: "Session ID is required." };
    }
    try {
        await prisma.$transaction([
            prisma.session.update({
                where: { id: sessionId },
                data: { isExpired: true }
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


/**
 * Function logoutAllOtherSessions.
 */
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
