

'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getActiveAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getUserNeupIds, getUserProfile, getPersonalAccountId, checkPermissions } from '@/lib/user-actions';

export type BranchAccount = {
    id: string;
    name: string;
    neupId: string;
    location?: string;
};

const formSchema = z.object({
    name: z.string().min(1, "Branch name is required"),
    neupIdSubdomain: z.string()
        .min(3, "Subdomain must be at least 3 characters.")
        .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens."),
    location: z.string().optional(),
});

export async function createBranchAccount(data: z.infer<typeof formSchema>, geolocation?: string) {
    const canManage = await checkPermissions(['linked_accounts.brand.manage']);
    if (!canManage) {
        return { success: false, error: "You do not have permission to create branch accounts." };
    }

    const parentBrandId = await getActiveAccountId();
    if (!parentBrandId) {
        return { success: false, error: "Managing brand account not found." };
    }
    
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = formSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { name, location } = validation.data;
    const neupIdSubdomain = validation.data.neupIdSubdomain.toLowerCase();
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';
    
    try {
        const parentNeupIds = await getUserNeupIds(parentBrandId);
        if (parentNeupIds.length === 0) {
            return { success: false, error: "Parent brand does not have a NeupID." };
        }
        const parentNeupId = parentNeupIds[0];
        const fullNeupId = `${parentNeupId}.${neupIdSubdomain}`;

        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', fullNeupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This Branch NeupID is already taken.' };
        }

        const batch = writeBatch(db);
        const newAccountRef = doc(collection(db, 'account'));
        const branchAccountId = newAccountRef.id;

        batch.set(newAccountRef, {
            type: 'branch',
            parentBrandId: parentBrandId,
            managedBy: [personalAccountId]
        });

        const newNeupIdRef = doc(db, 'neupid', fullNeupId);
        batch.set(newNeupIdRef, { for: branchAccountId, is_primary: true });

        batch.set(doc(db, "profile", branchAccountId), {
            displayName: name,
            createdAt: serverTimestamp(),
        });
        
        if (location) {
             const newContactRef = doc(collection(db, 'contact'));
             batch.set(newContactRef, {
                account_id: branchAccountId,
                contact_type: 'branchLocation',
                value: location
            });
        }
        
        await batch.commit();
        
        await logActivity(parentBrandId, `Created Branch Account: ${fullNeupId}`, 'Success', ipAddress, personalAccountId, geolocation);
        revalidatePath(`/manage/brand/${parentBrandId}/branch`);

        return { success: true, branchId: branchAccountId };

    } catch (error) {
        await logError('database', error, 'createBranchAccount');
        return { success: false, error: 'An unexpected error occurred during branch account creation.' };
    }
}

export async function checkBranchNeupIdAvailability(neupIdSubdomain: string): Promise<{ available: boolean, fullNeupId?: string }> {
    const parentBrandId = await getActiveAccountId();
    if (!parentBrandId) return { available: false };

    const lowerSubdomain = neupIdSubdomain.toLowerCase();

    if (!lowerSubdomain || lowerSubdomain.length < 3 || !/^[a-z0-9-]+$/.test(lowerSubdomain)) {
        return { available: false };
    }

    try {
        const parentNeupIds = await getUserNeupIds(parentBrandId);
        if (parentNeupIds.length === 0) {
            return { available: false };
        }
        const parentNeupId = parentNeupIds[0];
        const fullNeupId = `${parentNeupId}.${lowerSubdomain}`;

        const docRef = doc(db, 'neupid', fullNeupId);
        const docSnap = await getDoc(docRef);
        
        return { available: !docSnap.exists(), fullNeupId };

    } catch (error) {
        await logError('database', error, `checkBranchNeupIdAvailability: ${lowerSubdomain}`);
        return { available: false };
    }
}

export async function getBranches(brandId: string): Promise<BranchAccount[]> {
    if (!brandId) return [];
    
    const canManage = await checkPermissions(['linked_accounts.brand.manage']);
    if (!canManage) return [];

    try {
        const accountRef = collection(db, 'account');
        const q = query(accountRef, where('parentBrandId', '==', brandId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const branchAccounts = await Promise.all(
            querySnapshot.docs.map(async (docSnap) => {
                const branchAccountId = docSnap.id;
                const profile = await getUserProfile(branchAccountId);
                const neupIds = await getUserNeupIds(branchAccountId);
                
                const contactQuery = query(collection(db, 'contact'), where('account_id', '==', branchAccountId), where('contact_type', '==', 'branchLocation'));
                const contactSnapshot = await getDocs(contactQuery);
                const location = contactSnapshot.empty ? undefined : contactSnapshot.docs[0].data().value;

                if (!profile) return null;

                return {
                    id: branchAccountId,
                    name: profile.displayName || 'Unnamed Branch',
                    neupId: neupIds[0] || 'N/A',
                    location: location,
                };
            })
        );
        
        return branchAccounts.filter((account): account is BranchAccount => account !== null);

    } catch (error) {
        await logError('database', error, `getBranches for ${brandId}`);
        return [];
    }
}
