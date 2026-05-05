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
            if (authRequest.type !== flowType) {
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
                
                await prisma.authnRequest.update({
                    where: { id: currentId },
                    data: {
                        type: flowType,
                        status: 'pending',
                        data: {},
                        accountId: null,
                        expiresAt: expiresAt,
                    }
                });
            }
            return currentId;
        }
    }
    // If no valid currentId, create a new request
    return createAuthRequest(flowType);
}
