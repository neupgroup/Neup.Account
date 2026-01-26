'use server';

import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  collection,
  where,
  getDocs,
} from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { checkPermissions, getUserNeupIds } from '@/lib/user';
import { revalidatePath } from 'next/cache';

export async function addNeupId(accountId: string, neupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const lowerCaseNeupId = neupId.toLowerCase();

    try {
        const neupidRef = doc(db, 'neupid', lowerCaseNeupId);
        const neupidDoc = await getDoc(neupidRef);
        if (neupidDoc.exists()) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        await setDoc(neupidRef, {
            for: accountId,
            is_primary: false,
        });

        await logActivity(accountId, `NeupID added by admin: ${lowerCaseNeupId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `addNeupId for account ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function removeNeupId(neupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const neupidRef = doc(db, 'neupid', neupId);
        const neupidDoc = await getDoc(neupidRef);
        if (!neupidDoc.exists()) {
            return { success: false, error: 'NeupID not found.' };
        }
        
        if (neupidDoc.data().is_primary) {
            return { success: false, error: 'Cannot remove a primary NeupID. Set another as primary first.' };
        }
        
        const accountId = neupidDoc.data().for;
        await deleteDoc(neupidRef);

        await logActivity(accountId, `NeupID removed by admin: ${neupId}`, 'Success', undefined, adminId);
         revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `removeNeupId: ${neupId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function setPrimaryNeupId(accountId: string, newPrimaryNeupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const existingNeupIds = await getUserNeupIds(accountId);
        if (!existingNeupIds.includes(newPrimaryNeupId)) {
            return { success: false, error: 'This NeupID does not belong to the user.' };
        }
        
        const batch = writeBatch(db);
        
        // Unset old primary
        existingNeupIds.forEach(id => {
            const docRef = doc(db, 'neupid', id);
            batch.update(docRef, { is_primary: false });
        });
        
        // Set new primary
        const newPrimaryRef = doc(db, 'neupid', newPrimaryNeupId);
        batch.update(newPrimaryRef, { is_primary: true });

        await batch.commit();

        await logActivity(accountId, `Primary NeupID set to: ${newPrimaryNeupId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `setPrimaryNeupId for account ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
