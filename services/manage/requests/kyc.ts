'use server';

import prisma from '@/core/helpers/prisma';
import { getUserProfile, checkPermissions, getUserNeupIds } from '@/core/helpers/user';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';
import type { KycRequest } from '@/types';


export async function getPendingKycRequests(): Promise<KycRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const querySnapshot = await prisma.kycRequest.findMany({
            where: { status: 'pending' }
        });

        if (querySnapshot.length === 0) {
            return [];
        }

        const requests = await Promise.all(
            querySnapshot.map(async (doc) => {
                const accountId = doc.accountId;

                const [profile, neupIds] = await Promise.all([
                    getUserProfile(accountId),
                    getUserNeupIds(accountId)
                ]);

                return {
                    id: doc.id,
                    accountId,
                    userFullName: profile ? `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() : 'Unknown User',
                    userNeupId: neupIds[0] || 'N/A',
                    documentType: doc.documentType,
                    submittedAt: doc.submittedAt.toLocaleDateString() || 'N/A',
                    status: doc.status as 'pending' | 'approved' | 'rejected',
                    documentPhotoUrl: doc.documentPhotoUrl || 'https://placehold.co/600x400',
                    selfiePhotoUrl: doc.selfiePhotoUrl || 'https://placehold.co/400x400',
                };
            })
        );
        return requests;
    } catch (error) {
        await logError('database', error, 'getPendingKycRequests');
        return [];
    }
}

export async function approveKycRequest(kycId: string, accountId: string): Promise<{ success: boolean; error?: string }> {
    const canApprove = await checkPermissions(['root.requests.approve']);
    if (!canApprove) return { success: false, error: 'Permission denied.' };

    try {
        await prisma.$transaction([
            prisma.kycRequest.update({
                where: { id: kycId },
                data: { status: 'approved' }
            }),
            prisma.account.update({
                where: { id: accountId },
                data: { verified: true } // Assuming 'verified' in Account model maps to kycVerified
            })
        ]);

        await logActivity(accountId, 'KYC Approved', 'Success');
        revalidatePath('/manage/requests/kyc');
        return { success: true };
    } catch (error) {
        await logError('database', error, `approveKycRequest: ${kycId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function rejectKycRequest(kycId: string, accountId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const canDeny = await checkPermissions(['root.requests.deny']);
    if (!canDeny) return { success: false, error: 'Permission denied.' };

    try {
        await prisma.kycRequest.update({
            where: { id: kycId },
            data: { status: 'rejected', rejectionReason: reason }
        });
        
        await logActivity(accountId, `KYC Rejected. Reason: ${reason}`, 'Alert');
        revalidatePath('/manage/requests/kyc');
        return { success: true };
    } catch (error) {
        await logError('database', error, `rejectKycRequest: ${kycId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}