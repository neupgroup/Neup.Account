

'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { getUserProfile, checkPermissions, getUserNeupIds } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getPersonalAccountId } from '@/lib/auth-actions';
import type { VerificationRequest } from '@/types';

const verificationActionSchema = z.object({
    reason: z.string().min(10, "A reason of at least 10 characters is required."),
    category: z.string().min(3, "Category is required."),
});

export async function getPendingVerificationRequests(): Promise<VerificationRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const verificationsRef = collection(db, 'verifications');
        const q = query(verificationsRef, where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const requests = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                const accountId = data.accountId;

                const profile = await getUserProfile(accountId);

                return {
                    id: doc.id,
                    accountId,
                    fullName: profile?.displayName || `${profile?.firstName} ${profile?.lastName}`.trim() || 'Unknown User',
                    neupId: profile?.neupId || 'N/A',
                    requestedAt: data.requestedAt?.toDate()?.toLocaleDateString() || 'N/A',
                    status: data.status,
                };
            })
        );
        return requests;
    } catch (error) {
        await logError('database', error, 'getPendingVerificationRequests');
        return [];
    }
}

export async function grantVerification(accountId: string, data: z.infer<typeof verificationActionSchema>): Promise<{ success: boolean; error?: string }> {
    const canApprove = await checkPermissions(['root.requests.approve']);
    if (!canApprove) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    if (adminId === accountId) {
        return { success: false, error: 'Administrators cannot verify their own account.' };
    }

    const validation = verificationActionSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.reason?.[0] || validation.error.flatten().fieldErrors.category?.[0] };
    }

    const { reason, category } = validation.data;

    try {
        const batch = writeBatch(db);
        
        // Update account document
        const accountRef = doc(db, 'account', accountId);
        batch.update(accountRef, { verified: true });
        
        // Set verification details in verifications collection
        const verificationRef = doc(db, 'verifications', accountId);
        batch.set(verificationRef, {
            accountId,
            status: 'approved',
            verifiedBy: adminId,
            verifiedAt: serverTimestamp(),
            reason,
            category
        }, { merge: true });

        await batch.commit();

        await logActivity(accountId, `Account Verified. Category: ${category}`, 'Success', undefined, adminId);
        revalidatePath('/manage/root/accounts/[id]', 'page');
        return { success: true };
    } catch (error) {
        await logError('database', error, `grantVerification: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function revokeVerification(accountId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const canDeny = await checkPermissions(['root.requests.deny']);
    if (!canDeny) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    if (!reason || reason.length < 10) {
        return { success: false, error: "A reason of at least 10 characters is required to revoke." };
    }

    try {
        const batch = writeBatch(db);

        const accountRef = doc(db, 'account', accountId);
        batch.update(accountRef, { verified: false });

        const verificationRef = doc(db, 'verifications', accountId);
        batch.update(verificationRef, {
            status: 'revoked',
            revokedBy: adminId,
            revokedAt: serverTimestamp(),
            revocationReason: reason
        });
        
        await batch.commit();

        await logActivity(accountId, 'Account Verification Revoked', 'Alert', undefined, adminId);
        revalidatePath('/manage/root/accounts/[id]', 'page');
        return { success: true };
    } catch (error) {
        await logError('database', error, `revokeVerification: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
