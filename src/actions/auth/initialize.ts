'use server';

import prisma from '@/lib/prisma';
import { randomUUID } from 'crypto';

const AUTH_REQUEST_EXPIRATION_MINUTES = 7;

async function createAuthRequest(type: 'signup' | 'signin' | 'forgot_password') {
    const requestId = randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);

    await prisma.authRequest.create({
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

export async function initializeAuthFlow(
    currentId: string | null,
    flowType: 'signup' | 'signin' | 'forgot_password'
): Promise<string> {
    if (currentId) {
        const authRequest = await prisma.authRequest.findUnique({
            where: { id: currentId }
        });

        if (authRequest && authRequest.expiresAt > new Date()) {
            if (authRequest.type !== flowType) {
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
                
                await prisma.authRequest.update({
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
