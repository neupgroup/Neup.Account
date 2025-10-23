'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, limit } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { dependentFormSchema } from '@/schemas/dependent';
import { checkPermissions, getUserProfile, getUserNeupIds } from '@/lib/user';


export type DependentAccount = {
    id: string;
    nameDisplay: string;
    neupId: string;
    accountPhoto?: string;
};

export async function getDependentAccounts(): Promise<DependentAccount[]> {
    const canView = await checkPermissions(['linked_accounts.dependent.view']);
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

        const dependentAccountIds = permitsSnapshot.docs
            .map(doc => doc.data().target_account)
            .filter(Boolean);

        if (dependentAccountIds.length === 0) {
            return [];
        }

        // Fetch account details for only those that are dependent accounts
        const accountRef = collection(db, 'account');
        const dependentAccountsQuery = query(accountRef, where('__name__', 'in', dependentAccountIds), where('accountType', '==', 'dependent'));
        
        const querySnapshot = await getDocs(dependentAccountsQuery);

        if (querySnapshot.empty) {
            return [];
        }
        
        const dependentAccounts = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const accountId = doc.id;
                const profile = await getUserProfile(accountId);

                if (!profile) return null;

                return {
                    id: accountId,
                    nameDisplay: profile.nameDisplay || `${profile.nameFirst} ${profile.nameLast}`.trim(),
                    neupId: profile.neupIdPrimary || 'N/A',
                    accountPhoto: profile.accountPhoto,
                };
            })
        );
        
        return dependentAccounts.filter((account): account is NonNullable<typeof account> => account !== null);

    } catch (error) {
        await logError('database', error, 'getDependentAccounts');
        return [];
    }
}


export async function createDependentAccount(data: z.infer<typeof dependentFormSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.dependent.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a dependent account." };
    }

    const guardianAccountId = await getPersonalAccountId();
    if (!guardianAccountId) {
        return { success: false, error: "Guardian not authenticated." };
    }

    const validation = dependentFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { password, agreement, ...profileData } = validation.data;
    const neupId = profileData.neupId.toLowerCase();
    const ipAddress = (await headers()).get('x-forwarded-for') || 'Unknown IP';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const dependentAccountId = newAccountRef.id;
        
        const { neupId: _n, ...restOfProfile } = profileData;

        batch.set(newAccountRef, {
            accountType: 'dependent',
            accountStatus: 'active',
            verified: false,
            nameDisplay: `${profileData.firstName} ${profileData.lastName}`.trim(),
            accountPhoto: null,
            neupIdPrimary: neupId,
            ...restOfProfile,
            dateBirth: profileData.dob.toISOString(),
            dateCreated: serverTimestamp()
        });
        
        const [guardianPermSnap, dependentPermSnap] = await Promise.all([
            getDocs(query(collection(db, 'permission'), where('name', '==', 'individual.default'), limit(1))),
            getDocs(query(collection(db, 'permission'), where('name', '==', 'dependent.default'), limit(1)))
        ]);
        
        // Grant management permission to the guardian
        if (!guardianPermSnap.empty) {
            const permId = guardianPermSnap.docs[0].id;
            const newPermitRef = doc(collection(db, 'permit'));
            batch.set(newPermitRef, {
                account_id: guardianAccountId,
                target_account: dependentAccountId,
                for_self: false,
                is_root: false,
                full_access: true,
                permission: [permId],
                restrictions: [],
                created_on: serverTimestamp(),
            });
        }
        
        // Grant self-permissions to the dependent account
        if (!dependentPermSnap.empty) {
            const permId = dependentPermSnap.docs[0].id;
            const newPermitRef = doc(collection(db, 'permit'));
            batch.set(newPermitRef, {
                account_id: dependentAccountId,
                for_self: true,
                is_root: false,
                permission: [permId],
                restrictions: [],
                created_on: serverTimestamp(),
            });
        }


        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: dependentAccountId, is_primary: true });

        const hashedPassword = await bcrypt.hash(password, 10);
        batch.set(doc(db, 'auth_password', dependentAccountId), { pass: hashedPassword, passwordLastChanged: serverTimestamp() });
        
        await batch.commit();
        
        await logActivity(guardianAccountId, `Created Dependent Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/manage/accounts/dependent');

        return { success: true, dependentId: dependentAccountId };

    } catch (error) {
        await logActivity('unknown', `Dependent account creation failed: ${neupId}`, 'Failed', ipAddress, guardianAccountId, geolocation);
        await logError('database', error, 'createDependentAccount');
        return { success: false, error: 'An unexpected error occurred during account creation.' };
    }
}