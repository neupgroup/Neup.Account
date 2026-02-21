'use server';

import prisma from '@/lib/prisma';
import { getActiveAccountId, getActiveSession } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';

export type UserSession = {
    id: string;
    ipAddress: string;
    userAgent: string;
    lastLoggedIn: string;
    loginType: string;
    geolocation?: string;
    rawLastLoggedIn: Date;
};

export async function getUserSessions(): Promise<UserSession[]> {
    const accountId = await getActiveAccountId();
    if (!accountId) {
        return [];
    }

    try {
        const sessions = await prisma.session.findMany({
            where: {
                accountId: accountId,
                isExpired: false
            },
            orderBy: {
                lastLoggedIn: 'desc'
            }
        });
        
        type SessionInternal = UserSession & { rawLastLoggedIn: Date };

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

        return formattedSessions;
        
    } catch (error) {
        await logError('database', error, `getUserSessions: ${accountId}`);
        return [];
    }
}


export async function logoutSessionById(sessionId: string): Promise<{ success: boolean, error?: string }> {
    if (!sessionId) {
        return { success: false, error: "Session ID is required." };
    }
    try {
        await prisma.session.update({
            where: { id: sessionId },
            data: { isExpired: true }
        });
        
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
    const currentSession = await getActiveSession();
    if (!currentSession) {
        return { success: false, error: "No active session found." };
    }
    const { accountId, sessionId: currentSessionId } = currentSession;

    try {
        const result = await prisma.session.updateMany({
            where: {
                accountId: accountId,
                isExpired: false,
                id: {
                    not: currentSessionId
                }
            },
            data: {
                isExpired: true
            }
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
