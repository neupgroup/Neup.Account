'use server';

import prisma from '@/core/helpers/prisma';
import { getSessionCookies } from '@/core/helpers/cookies';

export type SessionVerifyResult =
    | { valid: true; accountId: string }
    | { valid: false };

/**
 * Verifies the active session against the database.
 * This is the authoritative check — it cannot be bypassed by client-side cache.
 * Called on every protected page mount to catch remote logouts and expired sessions.
 */
export async function verifyActiveSession(): Promise<SessionVerifyResult> {
    const { accountId, sessionId, sessionKey } = await getSessionCookies();

    if (!accountId || !sessionId || !sessionKey) {
        return { valid: false };
    }

    try {
        const session = await prisma.authSession.findUnique({
            where: { id: sessionId },
            select: {
                accountId: true,
                key: true,
                validTill: true,
                account: {
                    select: {
                        status: true,
                        details: true,
                    },
                },
            },
        });

        if (!session) return { valid: false };

        if (
            session.accountId !== accountId ||
            session.key !== sessionKey ||
            !session.validTill ||
            session.validTill < new Date()
        ) {
            return { valid: false };
        }

        // Check account is not blocked
        const details = session.account?.details as Record<string, any> | null;
        const block = details?.block;
        if (session.account?.status === 'blocked') {
            const isPermanent = block?.is_permanent;
            const until = block?.until ? new Date(block.until) : null;
            if (isPermanent || (until && until > new Date())) {
                return { valid: false };
            }
        }

        return { valid: true, accountId };
    } catch {
        return { valid: false };
    }
}
