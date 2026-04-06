'use server';

import prisma from '@/lib/prisma';
import { getUserProfile, getUserNeupIds, checkPermissions } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import type { PendingNeupIdRequest } from '@/types';

// Internal type to include raw date for sorting
type PendingRequestInternal = PendingNeupIdRequest & {
    createdAt: Date;
};


export async function getPendingNeupIdRequests(): Promise<PendingNeupIdRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const requests = await prisma.neupIdRequest.findMany({
            where: { status: 'pending' },
            include: {
                account: true
            }
        });

        if (requests.length === 0) {
            return [];
        }

        const pendingRequests = await Promise.all(
            requests.map(async (doc) => {
                const accountId = doc.accountId;

                const [profile, currentNeupIds] = await Promise.all([
                    getUserProfile(accountId),
                    getUserNeupIds(accountId)
                ]);

                const userFullName = profile ? `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() : 'Unknown User';
                
                const createdAt = doc.submittedAt;

                return {
                    id: doc.id,
                    userFullName,
                    requestedNeupId: doc.requestedId,
                    requestDate: createdAt.toLocaleDateString(),
                    status: doc.status,
                    currentNeupIds: currentNeupIds,
                    accountId: accountId,
                    createdAt: createdAt
                };
            })
        );
        const validRequests = pendingRequests.filter((request): request is PendingRequestInternal => request !== null);
        validRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return validRequests.map(({ createdAt, ...rest }) => rest);

    } catch (error) {
        await logError('database', error, 'getPendingNeupIdRequests');
        return [];
    }
}

export async function getNeupIdRequestDetails(id: string): Promise<PendingNeupIdRequest | null> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return null;

    try {
        const request = await prisma.neupIdRequest.findUnique({
            where: { id },
            include: {
                account: true
            }
        });

        if (!request) {
            return null;
        }

        const accountId = request.accountId;

        const [profile, currentNeupIds] = await Promise.all([
            getUserProfile(accountId),
            getUserNeupIds(accountId)
        ]);

        const userFullName = profile ? `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() : 'Unknown User';
        const createdAt = request.submittedAt;

        return {
            id: request.id,
            userFullName,
            requestedNeupId: request.requestedId,
            requestDate: createdAt.toLocaleDateString(),
            status: request.status,
            currentNeupIds: currentNeupIds,
            accountId: accountId,
        };
    } catch (error) {
        await logError('database', error, `getNeupIdRequestDetails: ${id}`);
        return null;
    }
}

export async function approveNeupIdRequest(requestId: string, accountId: string, newNeupId: string): Promise<{success: boolean, error?: string}> {
    const canApprove = await checkPermissions(['root.requests.approve']);
    if (!canApprove) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        await prisma.$transaction([
            prisma.neupIdRequest.update({
                where: { id: requestId },
                data: { status: 'approved' }
            }),
            prisma.neupId.create({
                data: {
                    id: newNeupId.toLowerCase(),
                    accountId: accountId,
                    isPrimary: false,
                }
            })
        ]);

        await logActivity(accountId, `Approved NeupID Request: ${newNeupId}`, 'Success');

        return { success: true };
    } catch (error) {
        await logError('database', error, `approveNeupIdRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function denyNeupIdRequest(requestId: string): Promise<{success: boolean, error?: string}> {
    const canDeny = await checkPermissions(['root.requests.deny']);
    if (!canDeny) {
        return { success: false, error: 'Permission denied.' };
    }
    
    try {
        const request = await prisma.neupIdRequest.update({
            where: { id: requestId },
            data: { status: 'denied' }
        });
        
        if (request.accountId) {
            await logActivity(request.accountId, `Denied NeupID Request: ${request.requestedId}`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, `denyNeupIdRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
