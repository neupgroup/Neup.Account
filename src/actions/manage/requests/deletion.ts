'use server';

import prisma from '@/lib/prisma';
import { getUserProfile, checkPermissions, isRootUser } from '@/lib/user';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { deleteUserAccount } from '@/actions/manage/user-actions';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { z } from 'zod';

export type DeletionRequest = {
  accountId: string;
  userFullName: string;
  userNeupId: string;
  requestedAt: string;
};

const requestByAdminSchema = z.object({
    reason: z.string().min(10, "A reason of at least 10 characters is required."),
});

export async function getDeletionRequests(): Promise<DeletionRequest[]> {
  const canView = await checkPermissions(['root.requests.view']);
  if (!canView) return [];

  try {
    const accounts = await prisma.account.findMany({
      where: { accountStatus: 'deletion_requested' }
    });

    if (accounts.length === 0) {
      return [];
    }

    const requests = await Promise.all(
      accounts.map(async (account) => {
        const accountId = account.id;
        const profile = await getUserProfile(accountId);

        const statusLog = await prisma.accountStatusLog.findFirst({
            where: {
                accountId,
                status: 'deletion_requested'
            },
            orderBy: { fromDate: 'desc' }
        });
        const requestedAt = statusLog?.fromDate?.toLocaleDateString() || 'N/A';

        return {
          accountId,
          userFullName:
            profile?.nameDisplay ||
            `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() ||
            'Unknown User',
          userNeupId: profile?.neupIdPrimary || 'N/A',
          requestedAt,
        };
      })
    );
    return requests;
  } catch (error) {
    await logError('database', error, 'getDeletionRequests');
    return [];
  }
}

export async function getDeletionStatus(accountId: string): Promise<{status: 'none' | 'pending' | 'deleted' | 'is_root', requestedAt?: string | null}> {
    try {
        const isTargetRoot = await isRootUser(accountId);
        if (isTargetRoot) {
            return { status: 'is_root' };
        }

        const account = await prisma.account.findUnique({
            where: { id: accountId }
        });

        if (!account) {
            return { status: 'deleted' };
        }

        const status = account.accountStatus;
        if (status === 'deletion_requested') {
            const statusLog = await prisma.accountStatusLog.findFirst({
                where: {
                    accountId,
                    status: 'deletion_requested'
                },
                orderBy: { fromDate: 'desc' }
            });
            const requestedAt = statusLog?.fromDate?.toLocaleDateString() || null;
            return { status: 'pending', requestedAt };
        }

        return { status: 'none' };
    } catch (error) {
        await logError('database', error, `getDeletionStatus for ${accountId}`);
        return { status: 'none' };
    }
}


export async function approveAccountDeletion(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
    const canApprove = await checkPermissions(['root.account.delete']);
    if (!canApprove) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    try {
        const result = await deleteUserAccount(accountId);
        if (result.success) {
            revalidatePath('/manage/requests/deletion');
             revalidatePath(`/manage/accounts/${accountId}`);
            return { success: true };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
         await logError('database', error, `approveAccountDeletion: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


export async function cancelAccountDeletion(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
    const canCancel = await checkPermissions(['root.requests.approve']);
    if (!canCancel) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    try {
        await prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: accountId },
                data: { accountStatus: 'active' }
            });

            const statusLog = await tx.accountStatusLog.findFirst({
                where: {
                    accountId,
                    status: 'deletion_requested'
                },
                orderBy: { fromDate: 'desc' }
            });

            if (statusLog) {
                await tx.accountStatusLog.update({
                    where: { id: statusLog.id },
                    data: {
                        status: 'request_cancelled',
                        remarks: `Request cancelled by admin ${adminId}.`
                    }
                });
            }
        });

        await logActivity(accountId, 'Account Deletion Cancelled by Admin', 'Success', undefined, adminId);
        revalidatePath('/manage/requests/deletion');
        revalidatePath(`/manage/accounts/${accountId}/deletion`);
        return { success: true };
    } catch (error) {
        await logError('database', error, `cancelAccountDeletion: ${accountId}`);
        return { success: false, error: 'Failed to cancel deletion request.' };
    }
}


export async function requestAccountDeletionByAdmin(accountId: string, data: z.infer<typeof requestByAdminSchema>): Promise<{ success: boolean; error?: string; }> {
    const canDelete = await checkPermissions(['root.account.delete']);
    if (!canDelete) {
        return { success: false, error: "Permission denied." };
    }
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.'};
    
    const validation = requestByAdminSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.reason?.[0] };
    }

    try {
        const isTargetRoot = await isRootUser(accountId);
        if (isTargetRoot) {
            return { success: false, error: "Root user accounts cannot be deleted this way." };
        }

        await prisma.$transaction(async (tx) => {
            await tx.account.update({
                where: { id: accountId },
                data: { accountStatus: 'deletion_requested' }
            });

            await tx.accountStatusLog.create({
                data: {
                    accountId: accountId,
                    status: 'deletion_requested',
                    remarks: `Admin initiated deletion. Reason: ${validation.data.reason}`,
                    moreInfo: `Request by admin: ${adminId}.`
                }
            });
        });

        await logActivity(accountId, "Account Deletion Requested by Admin", "Alert", undefined, adminId);
        revalidatePath(`/manage/accounts/${accountId}/deletion`);
        return { success: true };

    } catch (error) {
        await logError("database", error, `requestAccountDeletionByAdmin: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}