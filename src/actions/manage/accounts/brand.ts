

'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { checkPermissions, getUserProfile } from '@/lib/user';
import { logError } from '@/lib/logger';
import { switchToBrand as switchToBrandAction, switchToPersonal as switchToPersonalAction } from '@/lib/session';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { brandCreationSchema } from '@/schemas/auth';
import type { BrandAccount } from '@/types';
import { logActivity } from '@/lib/log-actions';


export async function getBrandAccounts(): Promise<BrandAccount[]> {
    const canView = await checkPermissions(['linked_accounts.brand.view']);
    if (!canView) return [];
    
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) {
        return [];
    }

    try {
        const permitsRef = collection(db, 'permit');
        const permitsQuery = query(
            permitsRef, 
            where('account_id', '==', personalAccountId),
            where('for_self', '==', false),
            where('is_root', '==', false)
        );
        const permitsSnapshot = await getDocs(permitsQuery);
        
        if (permitsSnapshot.empty) {
            return [];
        }

        const managedAccountIds = permitsSnapshot.docs
            .map(doc => doc.data().target_account)
            .filter(Boolean);

        if (managedAccountIds.length === 0) {
            return [];
        }

        const accountRef = collection(db, 'account');
        const brandAccountsQuery = query(
            accountRef, 
            where('__name__', 'in', managedAccountIds), 
            where('type', '==', 'brand')
        );
        
        const querySnapshot = await getDocs(brandAccountsQuery);

        if (querySnapshot.empty) {
            return [];
        }

        const brandAccounts = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const brandAccountId = doc.id;
                const profile = await getUserProfile(brandAccountId);

                if (!profile) return null;

                return {
                    id: brandAccountId,
                    name: profile.displayName || 'Unnamed Brand',
                    logoUrl: profile.displayPhoto,
                    plan: "Business" // Placeholder for plan
                };
            })
        );
        
        return brandAccounts.filter((account): account is BrandAccount => account !== null);

    } catch (error) {
        await logError('database', error, 'getBrandAccounts');
        return [];
    }
}

export async function createBrandAccount(data: z.infer<typeof brandCreationSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.brand.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a brand account." };
    }
    
    const creatorAccountId = await getPersonalAccountId();
    if (!creatorAccountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = brandCreationSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { fullName, legalName, registrationId, headOfficeLocation, servingAreas } = validation.data;
    const neupId = validation.data.neupId.toLowerCase();
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const brandAccountId = newAccountRef.id;

        batch.set(newAccountRef, {
            type: 'brand',
            status: 'active',
            verified: false,
            displayName: fullName,
            displayPhoto: null
        });

        // Grant management permission to the creator by creating a permit document
        const brandAdminPermQuery = query(collection(db, 'permission'), where('name', '==', 'brand.founder'), limit(1));
        const brandAdminPermSnap = await getDocs(brandAdminPermQuery);
        
        if (brandAdminPermSnap.empty) {
            await logError('database', new Error('brand.founder permission set not found'), 'createBrandAccount');
            return { success: false, error: 'Could not assign default management permissions. Please contact support.' };
        }

        const permId = brandAdminPermSnap.docs[0].id;
        const newPermitRef = doc(collection(db, 'permit'));
        batch.set(newPermitRef, {
            account_id: creatorAccountId, // The user who manages
            target_account: brandAccountId,     // The brand account being managed
            for_self: false,
            is_root: false,
            full_access: true,            // This user is the owner
            permission: [permId],          // The specific permission being granted
            restrictions: [],
            status: 'approved',            // The access is active immediately
            created_on: serverTimestamp(),
        });


        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: brandAccountId, is_primary: true });

        batch.set(doc(db, "profile", brandAccountId), {
            legalName: legalName || null,
            registrationId: registrationId || null,
            servingAreas: servingAreas || null,
            createdAt: serverTimestamp(),
        });
        
        if (headOfficeLocation) {
             const newContactRef = doc(collection(db, 'contact'));
             batch.set(newContactRef, {
                account_id: brandAccountId,
                contact_type: 'headOfficeLocation',
                value: headOfficeLocation
            });
        }
        
        await batch.commit();
        
        await logActivity(creatorAccountId, `Created Brand Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/manage/accounts/brand');

        return { success: true };

    } catch (error) {
        await logError('database', error, `createBrandAccount failed for neupId: ${neupId}`);
        return { success: false, error: 'An unexpected error occurred during brand account creation.' };
    }
}


export async function switchToBrand(brandId: string) {
    try {
        return await switchToBrandAction(brandId);
    } catch (error) {
        await logError('auth', error, `switchToBrand: ${brandId}`);
        return { success: false, error: 'Failed to switch to brand account.' };
    }
}

export async function switchToPersonal() {
    try {
        await switchToPersonalAction();
    } catch (error) {
        await logError('auth', error, `switchToPersonal`);
    }
}
