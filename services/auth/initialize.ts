'use server';

import prisma from '@/core/helpers/prisma';
import { randomUUID } from 'crypto';

const AUTH_REQUEST_EXPIRATION_MINUTES = 20;

/**
 * Function createAuthRequest.
 */
async function createAuthRequest(type: 'signup' | 'signin' | 'forgot_password') {
    const requestId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);

    await prisma.authnRequest.create({
        data: {
            id: requestId,
            type: type,
            status: 'pending',
            data: {},
            createdAt: new Date(),
            expiresAt: expiresAt,
        }
    });

    return requestId;
}


/**
 * Function initializeAuthFlow.
 */
export async function initializeAuthFlow(
    currentId: string | null,
    flowType: 'signup' | 'signin' | 'forgot_password'
): Promise<string> {
    if (currentId) {
        const authRequest = await prisma.authnRequest.findUnique({
            where: { id: currentId }
        });

        if (authRequest && authRequest.expiresAt > new Date()) {
            // If the user switches flow (signin <-> signup) we update the existing
            // auth request's type and refresh its expiry so the client can continue
            // using the same `AuthSessionRequest` id but with the new intent.
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);

            await prisma.authnRequest.update({
                where: { id: currentId },
                data: {
                    type: flowType,
                    expiresAt,
                },
            });

            return currentId;
        }
    }
    // If no valid currentId, create a new request
    return createAuthRequest(flowType);
}
