
'use server';

import { db } from '@/lib/firebase';
import { collection, writeBatch, query, where, getDocs, limit, serverTimestamp, doc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// A simple random string generator
function randomString(length: number) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function createTestAccount(isAdmin: boolean): Promise<{ success: boolean; error?: string; account?: { neupId: string; pass: string; } }> {
    try {
        const batch = writeBatch(db);
        const neupId = `${isAdmin ? 'admin' : 'testuser'}-${randomString(6)}`;
        const password = randomString(12);

        // 1. Create the account document
        const accountRef = doc(collection(db, 'account'));
        batch.set(accountRef, { type: 'individual' });

        // 2. Create the profile document
        const profileRef = doc(db, 'profile', accountRef.id);
        batch.set(profileRef, {
            firstName: isAdmin ? 'Admin' : 'Test',
            lastName: 'User',
            displayName: `${isAdmin ? 'Admin' : 'Test'} User`,
            createdAt: serverTimestamp(),
            dob: new Date(1990, 1, 1).toISOString(),
            gender: 'prefer_not_to_say',
            nationality: 'other'
        });

        // 3. Create the NeupID document
        const neupIdRef = doc(db, 'neupid', neupId);
        batch.set(neupIdRef, { for: accountRef.id, is_primary: true });

        // 4. Create the password document
        const passRef = doc(db, 'auth_password', accountRef.id);
        const hashedPassword = await bcrypt.hash(password, 10);
        batch.set(passRef, { pass: hashedPassword, passwordLastChanged: serverTimestamp() });

        // 5. Create the permit document
        const permissionSetName = isAdmin ? 'root.whole' : 'individual.default';
        const permissionQuery = query(collection(db, 'permission'), where('name', '==', permissionSetName), limit(1));
        const permissionSnapshot = await getDocs(permissionQuery);
        
        if (permissionSnapshot.empty) {
            return { success: false, error: `Permission set '${permissionSetName}' not found. Please populate permissions first.` };
        }
        
        const permissionId = permissionSnapshot.docs[0].id;
        const permitRef = doc(collection(db, 'permit'));
        batch.set(permitRef, {
            account_id: accountRef.id,
            is_root: true,
            permission: [permissionId],
            restricted_permission: [],
            created_on: serverTimestamp(),
        });
        
        await batch.commit();

        return { success: true, account: { neupId, pass: password } };
    } catch (e) {
        console.error(e);
        const error = e instanceof Error ? e.message : 'An unknown error occurred.';
        return { success: false, error };
    }
}
