
'use server';

import prisma from '@/lib/prisma';
import { checkPermissions } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export type KycSubmissionData = {
    documentType: 'passport' | 'license' | 'national_id';
    documentId: string;
    documentPhotoUrl: string;
    documentPhotoContentId: string;
    selfiePhotoUrl: string;
    selfiePhotoContentId: string;
};


export async function submitKyc(accountId: string, data: KycSubmissionData): Promise<{ success: boolean; error?: string }> {
    const canSubmit = await checkPermissions(['profile.kyc.submit']);
    if (!canSubmit) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        // Prevent duplicate pending submissions
        const existing = await prisma.kycRequest.findFirst({
            where: { accountId, status: 'pending' }
        });

        if (existing) {
            return { success: false, error: 'You already have a pending KYC submission.' };
        }

        await prisma.kycRequest.create({
            data: {
                accountId,
                status: 'pending',
                documentType: data.documentType,
                documentId: data.documentId,
                documentPhotoUrl: data.documentPhotoUrl,
                documentPhotoContentId: data.documentPhotoContentId,
                selfiePhotoUrl: data.selfiePhotoUrl,
                selfiePhotoContentId: data.selfiePhotoContentId,
            },
        });

        await logActivity(accountId, 'KYC Submitted', 'Pending');
        revalidatePath('/manage/profile/documents');

        return { success: true };
    } catch (error) {
        await logError('database', error, `submitKyc: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
