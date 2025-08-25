

'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, updateDoc, Timestamp, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { logError } from '@/lib/logger';

export type UserWithRole = {
  id: string;
  name: string;
  neupId: string;
  roleId: string;
  status: "Active" | "Inactive";
};

// --- ACTIONS ---

export async function getPermissions() {
    try {
        const permissionsCollection = collection(db, 'permission');
        const permissionsSnapshot = await getDocs(query(permissionsCollection, orderBy('name')));
        return permissionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        await logError('database', error, 'getPermissions (in users)');
        return [];
    }
}


export async function getUsersWithRoles(): Promise<UserWithRole[]> {
    try {
        const [profilesSnapshot] = await Promise.all([
          getDocs(collection(db, 'profile')),
        ]);
        
        const users: UserWithRole[] = await Promise.all(
            profilesSnapshot.docs.map(async (profileDoc) => {
                const accountId = profileDoc.id;
                const profileData = profileDoc.data();

                // Fetch role from permit collection
                const permitRef = collection(db, 'permit');
                const permitQuery = query(permitRef, where('account_id', '==', accountId), where('is_root', '==', true));
                const permitSnapshot = await getDocs(permitQuery);

                let permissionSetId = 'individual.default'; // Default role ID if none found
                 if (!permitSnapshot.empty) {
                    const permitData = permitSnapshot.docs[0].data();
                    if (permitData.permission && permitData.permission.length > 0) {
                      permissionSetId = permitData.permission[0];
                    }
                }


                // Fetch NeupID
                const neupidsRef = collection(db, 'neupid');
                const q = query(neupidsRef, where('for', '==', accountId));
                const neupidsSnapshot = await getDocs(q);
                const neupId = neupidsSnapshot.empty ? 'N/A' : neupidsSnapshot.docs[0].id;

                return {
                    id: accountId,
                    name: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim(),
                    neupId: neupId,
                    roleId: permissionSetId, // Reusing roleId to mean permissionSetId
                    status: 'Active' // Hardcoded as no status field exists in the current schema
                };
            })
        );
        return users;
    } catch (error) {
        await logError('database', error, 'getUsersWithRoles');
        return [];
    }
}

export async function updateUserRole(userId: string, newPermissionId: string): Promise<{ success: boolean }> {
    try {
        const batch = writeBatch(db);

        // Find the user's root permit document
        const permitRef = collection(db, 'permit');
        const q = query(permitRef, where('account_id', '==', userId), where('is_root', '==', true));
        const permitSnapshot = await getDocs(q);
        
        if (permitSnapshot.empty) {
            // No existing permit doc, create one
            const newPermitDocRef = doc(permitRef);
            batch.set(newPermitDocRef, {
                account_id: userId,
                is_root: true,
                created_on: serverTimestamp(),
                permission: [newPermissionId]
            });
        } else {
            // Existing permit doc, update it
            const existingPermitDocRef = permitSnapshot.docs[0].ref;
            batch.update(existingPermitDocRef, { permission: [newPermissionId] });
        }

        await batch.commit();

        return { success: true };
    } catch (error) {
        await logError('database', error, `updateUserRole: ${userId}`);
        return { success: false };
    }
}
