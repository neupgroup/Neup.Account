
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
        const kycRef = collection(db, 'kyc');
        const q = query(kycRef, where('accountId', '==', accountId), where('status', '==', 'pending'));
        const existing = await getDocs(q);
        if (!existing.empty) {
            return { success: false, error: 'You already have a pending KYC submission.' };
        }

        await addDoc(collection(db, 'kyc'), {
            accountId,
            status: 'pending',
            submittedAt: serverTimestamp(),
            documentType: data.documentType,
            documentId: data.documentId,
            documentPhotoUrl: data.documentPhotoUrl,
            documentPhotoContentId: data.documentPhotoContentId,
            selfiePhotoUrl: data.selfiePhotoUrl,
            selfiePhotoContentId: data.selfiePhotoContentId,
        });

        await logActivity(accountId, 'KYC Submitted', 'Pending');
        revalidatePath('/manage/profile/documents');

        return { success: true };
    } catch (error) {
        await logError('database', error, `submitKyc: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
