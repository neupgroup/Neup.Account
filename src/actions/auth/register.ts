'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, limit, serverTimestamp, writeBatch } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { createAndSetSession } from '@/lib/session';
import { checkNeupIdAvailability } from '@/lib/user';
import { logError } from '@/lib/logger';
import { registrationSchema } from '@/schemas/auth';
import type { z } from 'zod';

async function isFirstUser() {
    const accountsCollection = collection(db, 'account');
    const accountsSnapshot = await getDocs(query(accountsCollection, limit(1)));
    return accountsSnapshot.empty;
}


export async function registerUser(data: z.infer<typeof registrationSchema>) {
    const validation = registrationSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { password, geolocation } = validation.data;
    const neupId = validation.data.neupId.toLowerCase();
    
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('__name__', '==', neupId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        const isAdmin = await isFirstUser();
        const permissionSetName = isAdmin ? 'root.whole' : 'individual.default';
        
        let finalGender = validation.data.gender;
        if (validation.data.gender === 'custom') {
            finalGender = `c.${validation.data.customGender?.trim() || 'custom'}`;
        }

        const batch = writeBatch(db);

        const newAccountRef = doc(collection(db, 'account'));
        const accountId = newAccountRef.id;
        
        batch.set(doc(db, 'account', accountId), { type: 'individual' });

        const permQuery = query(collection(db, 'permission'), where('name', '==', permissionSetName), limit(1));
        const permSnap = await getDocs(permQuery);
        
        if (!permSnap.empty) {
            const permId = permSnap.docs[0].id;
            const newPermitRef = doc(collection(db, 'permit'));
            batch.set(newPermitRef, {
                account_id: accountId,
                for_self: !isAdmin,
                is_root: isAdmin,
                permission: [permId],
                restrictions: [],
                created_on: serverTimestamp(),
            });
        }


        const newNeupIdRef = doc(db, 'neupid', neupId);
        batch.set(newNeupIdRef, { for: accountId, is_primary: true });

        const hashedPassword = await bcrypt.hash(password, 10);
        batch.set(doc(db, 'auth_password', accountId), { pass: hashedPassword, passwordLastChanged: serverTimestamp() });
        
        const { password: _p, agreement: _a, gender, customGender, geolocation: _g, neupId: _n, ...profileData } = validation.data;
        batch.set(doc(db, "profile", accountId), { ...profileData, gender: finalGender, createdAt: serverTimestamp() });
        
        await batch.commit();
        
        await logActivity(accountId, 'User Registration', 'Success', ipAddress, undefined, geolocation);
        await createAndSetSession(accountId, 'Registration', ipAddress, userAgent, geolocation);

        return { success: true };
    } catch (error) {
        await logError('database', error, 'registerUser');
        return { success: false, error: 'An unexpected error occurred during registration.' };
    }
}
