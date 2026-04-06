'use server';

import prisma from '@/core/helpers/prisma';
import { getUserProfile, checkPermissions } from '@/core/helpers/user';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';

export type DisplayNameRequest = {
  id: string;
  accountId: string;
  userFullName: string;
  requestedDisplayName: string;
  createdAt: string;
};

export async function getDisplayNameRequests(): Promise<DisplayNameRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const requests = await prisma.request.findMany({
            where: {
                action: 'display_name_request',
                status: 'pending'
            },
            orderBy: { createdAt: 'desc' }
        });

        if (requests.length === 0) {
            return [];
        }

        const formattedRequests = await Promise.all(
            requests.map(async (doc) => {
                const accountId = doc.senderId; // Assuming senderId is the one requesting
                const profile = await getUserProfile(accountId);
                const data = doc.data as any;

                return {
                    id: doc.id,
                    accountId,
                    userFullName: profile?.nameDisplay || `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() || 'Unknown',
                    requestedDisplayName: data?.requestedDisplayName || 'N/A',
                    createdAt: doc.createdAt.toLocaleString(),
                };
            })
        );
        return formattedRequests;
    } catch (error) {
        await logError('database', error, 'getDisplayNameRequests');
        return [];
    }
}

export async function processDisplayNameRequest(requestId: string, accountId: string, displayName: string, approve: boolean) {
    const canApprove = await checkPermissions(['root.requests.approve']);
    if (!canApprove) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) {
        return { success: false, error: "Administrator not authenticated."};
    }

    try {
        await prisma.$transaction(async (tx) => {
            // Update request status
            await tx.request.update({
                where: { id: requestId },
                data: { status: approve ? 'approved' : 'rejected' }
            });

            if (approve) {
                // Update user's account document
                await tx.account.update({
                    where: { id: accountId },
                    data: { displayName }
                });
                await logActivity(accountId, `Display name change approved: ${displayName}`, "Success", undefined, adminId);
            } else {
                await logActivity(accountId, `Display name change rejected: ${displayName}`, "Failed", undefined, adminId);
            }
        });

        revalidatePath('/manage/requests/display-name');
        return { success: true };
    } catch (error) {
        await logError('database', error, `processDisplayNameRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
