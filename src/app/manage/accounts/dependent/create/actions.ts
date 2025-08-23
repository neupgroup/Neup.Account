

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
import { formSchema } from './schema';
import { checkPermissions } from '@/lib/user-actions';


export async function createDependentAccount(data: z.infer<typeof formSchema>, geolocation?: string) {
    const canCreate = await checkPermissions(['linked_accounts.dependent.create']);
    if (!canCreate) {
        return { success: false, error: "You do not have permission to create a dependent account." };
    }

    const guardianAccountId = await getPersonalAccountId();
    if (!guardianAccountId) {
        return { success: false, error: "Guardian not authenticated." };
    }

    const validation = formSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { password, ...rest } = validation.data;
    const neupId = rest.neupId.toLowerCase();
    const ipAddress = headers().get('x-forwarded-for') || 'Unknown IP';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        let finalGender = rest.gender;
        if (rest.gender === 'custom') {
            finalGender = `c.${rest.customGender?.trim() || 'custom'}`;
        }
        
        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const dependentAccountId = newAccountRef.id;

        batch.set(newAccountRef, {
            type: 'dependent',
        });
        
        // Grant management permission to the guardian
        const defaultPermQuery = query(collection(db, 'permission'), where('name', '==', 'individual.default'), limit(1));
        const defaultPermSnap = await getDocs(defaultPermQuery);
        if (!defaultPermSnap.empty) {
            const permId = defaultPermSnap.docs[0].id;
            const newPermitRef = doc(collection(db, 'permit'));
            batch.set(newPermitRef, {
                account_id: guardianAccountId, // The user who manages
                target_id: dependentAccountId, // The account being managed
                is_root: false,
                permission: [permId],
                created_on: serverTimestamp(),
                managed_by: guardianAccountId,
            });
        }


        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: dependentAccountId, is_primary: true });

        const hashedPassword = await bcrypt.hash(password, 10);
        batch.set(doc(db, 'auth_password', dependentAccountId), { pass: hashedPassword, passwordLastChanged: serverTimestamp() });
        
        const { agreement: _a, gender, customGender, neupId: _n, ...profileData } = rest;
        
        batch.set(doc(db, "profile", dependentAccountId), { 
            ...profileData, 
            dob: profileData.dob.toISOString(),
            gender: finalGender, 
            createdAt: serverTimestamp() 
        });
        
        await batch.commit();
        
        await logActivity(guardianAccountId, `Created Dependent Account: ${neupId}`, 'Success', ipAddress, undefined, geolocation);
        revalidatePath('/manage/accounts');

        return { success: true, dependentId: dependentAccountId };

    } catch (error) {
        await logError('database', error, 'createDependentAccount');
        return { success: false, error: 'An unexpected error occurred during account creation.' };
    }
}
