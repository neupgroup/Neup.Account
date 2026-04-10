'use server';

import prisma from '@/core/helpers/prisma';
import { getUserProfile, checkPermissions, getUserNeupIds } from '@/core/helpers/user';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';

export type Invitation = {
    notificationId: string;
    requestId: string;
    action: string;
    senderId: string;
    senderName: string;
    senderNeupId: string;
    createdAt: string;
};

/**
 * Function getInvitations.
 */
export async function getInvitations(): Promise<Invitation[]> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return [];

    try {
        const notifications = await prisma.notification.findMany({
            where: { accountId },
            include: {
                request: true
            }
        });

        const invitations: Invitation[] = [];
        for (const notif of notifications) {
            if (!notif.requestId || !notif.request || notif.request.status !== 'pending') continue;

            const request = notif.request;
            const senderProfile = await getUserProfile(request.senderId);
            const senderNeupIds = await prisma.neupId.findMany({
                where: { accountId: request.senderId }
            });

            invitations.push({
                notificationId: notif.id,
                requestId: request.id,
                action: request.action,
                senderId: request.senderId,
                senderName: senderProfile?.nameDisplay || `${senderProfile?.nameFirst || ''} ${senderProfile?.nameLast || ''}`.trim() || 'A user',
                senderNeupId: senderNeupIds[0]?.id || 'N/A',
                createdAt: notif.createdAt.toISOString(),
            });
        }

        invitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return invitations;
    } catch (error) {
        await logError('database', error, 'getInvitations');
        return [];
    }
}


/**
 * Function acceptRequest.
 */
export async function acceptRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
     const inviteeId = await getPersonalAccountId();
    if (!inviteeId) return { success: false, error: 'User not authenticated.' };

    try {
        const request = await prisma.request.findUnique({
            where: { id: requestId }
        });

        if (!request) return { success: false, error: 'Request not found.' };
        if (request.recipientId !== inviteeId) {
            return { success: false, error: 'This invitation is not for you.' };
        }

        await prisma.$transaction(async (tx) => {
            if (request.action === 'family_invitation') {
                const inviterId = request.senderId;

                // Find family by memberIds (using @> for array containment in Postgres)
                const families = await tx.$queryRaw<any[]>`
                    SELECT * FROM families 
                    WHERE "memberIds" @> ARRAY[${inviterId}]::text[] 
                       OR "memberIds" @> ARRAY[${inviteeId}]::text[]
                    LIMIT 1
                `;

                let family;
                if (families.length > 0) {
                    family = families[0];
                }

                let updatedMembers: any[] = [];
                let updatedMemberIds: string[] = [];
                const now = new Date();

                if (family) {
                    updatedMembers = Array.isArray(family.members) ? family.members : JSON.parse(family.members);
                    updatedMemberIds = family.memberIds;
                } else {
                    updatedMembers = [];
                    updatedMemberIds = [];
                }

                if (!updatedMemberIds.includes(inviterId)) {
                    updatedMembers.push({ accountId: inviterId, addedOn: now, addedBy: inviterId, hidden: false, status: 'approved' });
                    updatedMemberIds.push(inviterId);
                }
                if (!updatedMemberIds.includes(inviteeId)) {
                    updatedMembers.push({ accountId: inviteeId, addedOn: now, addedBy: inviterId, hidden: request.type === 'partner', status: 'approved' });
                    updatedMemberIds.push(inviteeId);
                }

                if (family) {
                    await tx.family.update({
                        where: { id: family.id },
                        data: {
                            members: updatedMembers,
                            memberIds: updatedMemberIds
                        }
                    });
                } else {
                    await tx.family.create({
                        data: {
                            createdBy: inviterId,
                            memberIds: updatedMemberIds,
                            members: updatedMembers
                        }
                    });
                }

            } else if (request.action === 'access_invitation') {
                await tx.permit.create({
                    data: {
                        accountId: inviteeId,
                        targetAccountId: request.senderId,
                        permissions: ['independent.default'],
                        forSelf: false,
                        isRoot: false,
                        restrictions: [],
                        createdOn: new Date()
                    }
                });
            }

            await tx.request.update({
                where: { id: requestId },
                data: { status: 'approved' }
            });

            await tx.notification.delete({
                where: { id: notificationId }
            });
        });

        revalidatePath('/manage/people/invitations');
        revalidatePath('/manage/notifications');
        revalidatePath('/manage/access');
        revalidatePath('/manage/people/family');
        return { success: true };
    } catch (error) {
        await logError('database', error, `acceptRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


/**
 * Function rejectRequest.
 */
export async function rejectRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
    const inviteeId = await getPersonalAccountId();
    if (!inviteeId) return { success: false, error: 'User not authenticated.' };

    try {
        const request = await prisma.request.findUnique({
            where: { id: requestId }
        });

        if (!request || request.recipientId !== inviteeId) {
            return { success: false, error: 'Request not found or you do not have permission to reject it.' };
        }

        await prisma.$transaction([
            prisma.request.update({
                where: { id: requestId },
                data: { status: 'rejected' }
            }),
            prisma.notification.delete({
                where: { id: notificationId }
            })
        ]);

        revalidatePath('/manage/people/invitations');
        revalidatePath('/manage/notifications');
        return { success: true };
    } catch (error) {
        await logError('database', error, `rejectRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
