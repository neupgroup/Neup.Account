'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getUserProfile, checkPermissions, getUserNeupIds } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import type { KycRequest } from '@/types';


export async function getPendingKycRequests(): Promise<KycRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const kycRef = collection(db, 'kyc');
        const q = query(kycRef, where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const requests = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                const accountId = data.accountId;

                const [profile, neupIds] = await Promise.all([
                    getUserProfile(accountId),
                    getUserNeupIds(accountId)
                ]);

                return {
                    id: doc.id,
                    accountId,
                    userFullName: profile ? `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() : 'Unknown User',
                    userNeupId: neupIds[0] || 'N/A',
                    documentType: data.documentType,
                    submittedAt: data.submittedAt?.toDate()?.toLocaleDateString() || 'N/A',
                    status: data.status,
                    documentPhotoUrl: data.documentPhotoUrl || 'https://placehold.co/600x400',
                    selfiePhotoUrl: data.selfiePhotoUrl || 'https://placehold.co/400x400',
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
        const kycRef = doc(db, 'kyc', kycId);
        await updateDoc(kycRef, { status: 'approved' });

        // Optionally, update the user's main profile/account to mark as verified
        const accountRef = doc(db, 'account', accountId);
        await updateDoc(accountRef, { kycVerified: true });

        await logActivity(accountId, 'KYC Approved', 'Success');
        revalidatePath('/manage/root/requests/kyc');
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
        const kycRef = doc(db, 'kyc', kycId);
        await updateDoc(kycRef, { status: 'rejected', rejectionReason: reason });
        
        await logActivity(accountId, `KYC Rejected. Reason: ${reason}`, 'Alert');
        revalidatePath('/manage/root/requests/kyc');
        return { success: true };
    } catch (error) {
        await logError('database', error, `rejectKycRequest: ${kycId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}