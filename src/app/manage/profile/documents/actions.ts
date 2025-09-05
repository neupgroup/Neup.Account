
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { checkPermissions } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import type { KycFormValues } from '@/schemas/kyc';

// In a real app, you would use a cloud storage service like Firebase Storage
// and upload the files there, storing the URL in Firestore.
// For this prototype, we'll just use placeholder Data URIs.

export async function submitKyc(accountId: string, data: KycFormValues): Promise<{ success: boolean; error?: string }> {
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

        // Mock file upload - in real life, get download URLs from Firebase Storage
        const documentPhotoUrl = data.documentPhoto instanceof File ? 'data:image/jpeg;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAE...' : data.documentPhoto;
        const selfiePhotoUrl = typeof data.selfiePhoto === 'string' ? data.selfiePhoto : 'data:image/jpeg;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAE...';

        await addDoc(collection(db, 'kyc'), {
            accountId,
            status: 'pending',
            submittedAt: serverTimestamp(),
            documentType: data.documentType,
            documentId: data.documentId,
            documentPhotoUrl,
            selfiePhotoUrl,
        });

        await logActivity(accountId, 'KYC Submitted', 'Pending');
        revalidatePath('/manage/profile/documents');

        return { success: true };
    } catch (error) {
        await logError('database', error, `submitKyc: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
