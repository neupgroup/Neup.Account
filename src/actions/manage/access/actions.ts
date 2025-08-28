'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  writeBatch,
  limit
} from 'firebase/firestore';
import { getActiveAccountId, getPersonalAccountId } from '@/lib/auth-actions';
import { getUserProfile, getUserNeupIds, getAccountType, getUserPermissions, checkPermissions } from '@/lib/user';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logActivity } from '@/lib/log-actions';
import type { UserAccess, AccessDetails, Permission } from '@/types';

export type Invitation = {
    permitId: string;
    grantedBy: {
        name: string;
        neupId: string;
        displayPhoto?: string;
    };
    grantedOn: string;
}

const addAccessSchema = z.object({
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
});

const statusOrder: Record<UserAccess['status'], number> = {
    'approved': 1,
    'pending': 2,
    'rejected': 3,
};


export async function getAccessList(accountId: string): Promise<UserAccess[]> {
  try {
    const permitsRef = collection(db, 'permit');
    const q = query(
      permitsRef,
      where('target_account', '==', accountId),
      where('for_self', '==', false),
      where('is_root', '==', false)
    );
    const querySnapshot = await getDocs(q);

    const accessList = await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const userProfile = await getUserProfile(data.account_id);
        if (!userProfile) return null;

        return {
          permitId: doc.id,
          userId: data.account_id,
          displayName:
            userProfile.displayName ||
            `${userProfile.firstName} ${userProfile.lastName}`.trim(),
          displayPhoto: userProfile.displayPhoto,
          permissions: data.permission || [],
          status: 'approved',
        };
      })
    );

    const validUsers = accessList.filter((user): user is UserAccess => user !== null);

    return validUsers;

  } catch (error) {
    await logError('database', error, `getAccessList for ${accountId}`);
    return [];
  }
}

export async function getAccessDetails(permitId: string): Promise<AccessDetails | null> {
    try {
        const permitRef = doc(db, 'permit', permitId);
        const permitDoc = await getDoc(permitRef);

        if (!permitDoc.exists()) {
            return null;
        }

        const data = permitDoc.data();
        
        const [grantedToProfile, grantedByProfile, grantedToNeupIds] = await Promise.all([
            getUserProfile(data.account_id), // The user who has access
            getUserProfile(data.target_account),   // The account being accessed
            getUserNeupIds(data.account_id)
        ]);

        if (!grantedToProfile || !grantedByProfile) {
            return null;
        }

        return {
            permitId: permitDoc.id,
            grantedTo: {
                id: data.account_id,
                name: grantedToProfile.displayName || `${grantedToProfile.firstName} ${grantedToProfile.lastName}`.trim(),
                neupId: grantedToNeupIds[0] || 'N/A'
            },
            grantedBy: {
                id: data.target_account,
                name: grantedByProfile.displayName || `${grantedByProfile.firstName} ${grantedByProfile.lastName}`.trim()
            },
            grantedOn: data.created_on?.toDate().toLocaleString() || new Date().toLocaleString(),
            permissions: data.permission || []
        }

    } catch (error) {
        await logError('database', error, `getAccessDetails for ${permitId}`);
        return null;
    }
}

export async function removeAccess(permitId: string, geolocation?: string): Promise<{ success: boolean; error?: string }> {
    const currentAccountId = await getActiveAccountId();
     if (!currentAccountId) {
        return { success: false, error: "Not authenticated." };
    }
    
    try {
        const docRef = doc(db, 'permit', permitId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || docSnap.data().target_account !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }
        
        const removedUserId = docSnap.data().account_id;
        await deleteDoc(docRef);
        await logActivity(currentAccountId, `Revoked access for user ${removedUserId}`, 'Success', undefined, undefined, geolocation);
        
        revalidatePath('/manage/access');
        revalidatePath(`/manage/access/${permitId}`);
        return { success: true };
    } catch (error) {
        await logError('database', error, `removeAccess: ${permitId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function getDelegatablePermissions(): Promise<Permission[]> {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) return [];

    // Query for the user's own root permit or self permit
    const permitQuery = query(collection(db, 'permit'), where('account_id', '==', personalAccountId), where('for_self', '==', true));
    const permitSnapshot = await getDocs(permitQuery);
    
    if (permitSnapshot.empty) {
        // As a fallback, check if they are a root user (older data model)
        const rootPermitQuery = query(collection(db, 'permit'), where('account_id', '==', personalAccountId), where('is_root', '==', true));
        const rootPermitSnapshot = await getDocs(rootPermitQuery);
        if (rootPermitSnapshot.empty) return [];
        
        const permitData = rootPermitSnapshot.docs[0].data();
         if (permitData.full_permit) {
            const permsQuery = query(collection(db, 'permission'), where('name', '!=', 'root.whole'));
            const permsSnapshot = await getDocs(permsQuery);
            return permsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission)).filter(p => !p.name.startsWith('root.'));
        }
    }
    
    const permitData = permitSnapshot.docs[0].data();
    
    // If user has full permit, they can delegate any non-root permission
    if (permitData.full_permit) {
        const permsQuery = query(collection(db, 'permission'), where('name', '!=', 'root.whole'));
        const permsSnapshot = await getDocs(permsQuery);
        return permsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission)).filter(p => !p.name.startsWith('root.'));
    }
    
    // Otherwise, they can only delegate the permissions they are explicitly assigned
    const assignedIds = permitData.permission || [];
    if (assignedIds.length === 0) return [];
    
    const permsQuery = query(collection(db, 'permission'), where('__name__', 'in', assignedIds));
    const permsSnapshot = await getDocs(permsQuery);
    return permsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission));
}


export async function updatePermissions(permitId: string, newPermissionIds: string[], geolocation?: string): Promise<{ success: boolean, error?: string}> {
    const currentAccountId = await getActiveAccountId();
    if (!currentAccountId) {
        return { success: false, error: "Not authenticated." };
    }

    try {
        const docRef = doc(db, 'permit', permitId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || docSnap.data().target_account !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }

        // --- Permission Delegation Check ---
        const delegatablePerms = await getDelegatablePermissions();
        const delegatablePermIds = new Set(delegatablePerms.map(p => p.id));
        const isAllowed = newPermissionIds.every(id => delegatablePermIds.has(id));

        if (!isAllowed) {
            return { success: false, error: "You are trying to grant permissions you do not possess." };
        }
        // --- End Check ---
        
        const targetUserId = docSnap.data().account_id;
        await updateDoc(docRef, { permission: newPermissionIds });
        
        await logActivity(currentAccountId, `Updated permissions for user ${targetUserId}`, 'Success', undefined, undefined, geolocation);
        revalidatePath('/manage/access');
        revalidatePath(`/manage/access/${permitId}`);
        return { success: true };

    } catch (error) {
        await logError('database', error, `updatePermissions: ${permitId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function grantAccessByNeupId(formData: FormData, geolocation?: string): Promise<{ success: boolean; error?: string; }> {
    const ownerAccountId = await getActiveAccountId();
    if (!ownerAccountId) {
        return { success: false, error: "Not authenticated." };
    }

    const validation = addAccessSchema.safeParse({ neupId: formData.get('neupId') });
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.neupId?.[0] };
    }
    const neupId = validation.data.neupId.toLowerCase();

    try {
        // Find the account to add
        const neupidsRef = doc(db, 'neupid', neupId);
        const userSnapshot = await getDoc(neupidsRef);

        if (!userSnapshot.exists()) {
            return { success: false, error: "No user found with that NeupID." };
        }
        const targetAccountId = userSnapshot.data().for;

        // Prevent adding self
        if (targetAccountId === ownerAccountId) {
            return { success: false, error: "You cannot grant access to yourself." };
        }
        
        const targetAccountType = await getAccountType(targetAccountId);
        if (targetAccountType !== 'individual' && targetAccountType !== 'dependent') {
            return { success: false, error: "You can only grant access to individual accounts." };
        }


        // Check if already added
        const permitsRef = collection(db, 'permit');
        const alreadyExistsQuery = query(permitsRef, where('target_account', '==', ownerAccountId), where('account_id', '==', targetAccountId));
        const alreadyExistsSnapshot = await getDocs(alreadyExistsQuery);
        if (!alreadyExistsSnapshot.empty) {
            return { success: false, error: "This user already has access." };
        }
        
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('action', '==', 'access_invitation'),
            where('sender_id', '==', ownerAccountId),
            where('recipient_id', '==', targetAccountId),
            where('status', '==', 'pending')
        );
        const existingRequests = await getDocs(q);
        if(!existingRequests.empty) {
            return { success: false, error: 'An invitation has already been sent to this user.' };
        }


        // Add the new access document with a 'pending' status
        const requestRef = await addDoc(requestsRef, {
            action: 'access_invitation',
            sender_id: ownerAccountId,
            recipient_id: targetAccountId,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        
        await addDoc(collection(db, 'notifications'), {
            recipient_id: targetAccountId,
            request_id: requestRef.id,
            is_read: false,
            createdAt: serverTimestamp()
        });


        await logActivity(ownerAccountId, `Sent access invitation to ${neupId}`, 'Pending', undefined, undefined, geolocation);
        revalidatePath('/manage/access');
        return { success: true };

    } catch (error) {
        await logError('database', error, 'grantAccessByNeupId');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
