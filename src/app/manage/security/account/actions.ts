'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { getUserProfile, checkPermissions } from '@/lib/user';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type RecoveryAccount = {
  id: string; // Document ID in recovery_contacts
  recoveryAccountId: string;
  recoveryNeupId: string;
  displayName: string;
  displayPhoto?: string;
  status: 'pending' | 'approved' | 'rejected';
};

const addAccountSchema = z.object({
  neupId: z
    .string()
    .min(3, 'NeupID must be at least 3 characters.')
    .max(16, 'NeupID cannot be more than 16 characters.'),
});

const statusOrder: Record<RecoveryAccount['status'], number> = {
  approved: 1,
  pending: 2,
  rejected: 3,
};

// Fetches the recovery accounts for the currently logged-in user.
export async function getRecoveryAccounts(): Promise<RecoveryAccount[]> {
  const canView = await checkPermissions(['security.recovery_accounts.view']);
  if (!canView) return [];

  const ownerAccountId = await getPersonalAccountId();
  if (!ownerAccountId) {
    return [];
  }

  try {
    const recoveryRef = collection(db, 'recovery_contacts');
    const q = query(recoveryRef, where('ownerAccountId', '==', ownerAccountId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return [];
    }

    const recoveryContacts = await Promise.all(
      querySnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const profile = await getUserProfile(data.recoveryAccountId);
        return {
          id: doc.id,
          recoveryAccountId: data.recoveryAccountId,
          recoveryNeupId: data.recoveryNeupId,
          displayName:
            profile?.displayName ||
            `${profile?.nameFirst} ${profile?.nameLast}`.trim() ||
            data.recoveryNeupId,
          displayPhoto: profile?.accountPhoto,
          status: data.status || 'pending',
        };
      })
    );

    recoveryContacts.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

    return recoveryContacts;
  } catch (error) {
    await logError('database', error, 'getRecoveryAccounts');
    return [];
  }
}

// Adds a new recovery account for the currently logged-in user.
export async function addRecoveryAccount(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  newAccount?: RecoveryAccount;
}> {
  const canAdd = await checkPermissions(['security.recovery_accounts.add']);
  if (!canAdd) return { success: false, error: 'Permission denied.' };

  const ownerAccountId = await getPersonalAccountId();
  if (!ownerAccountId) {
    return { success: false, error: 'User not authenticated.' };
  }

  const validation = addAccountSchema.safeParse({
    neupId: formData.get('neupId'),
  });
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.flatten().fieldErrors.neupId?.[0],
    };
  }

  const { neupId } = validation.data;

  try {
    // 1. Check current number of recovery accounts
    const recoveryRef = collection(db, 'recovery_contacts');
    const currentQuery = query(
      recoveryRef,
      where('ownerAccountId', '==', ownerAccountId)
    );
    const currentSnapshot = await getDocs(currentQuery);
    if (currentSnapshot.size >= 5) {
      return {
        success: false,
        error: 'You cannot add more than 5 recovery accounts.',
      };
    }

    // 2. Find the account to add
    const neupidsRef = collection(db, 'neupid');
    const userQuery = query(neupidsRef, where('__name__', '==', neupId), limit(1));
    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
      return { success: false, error: 'No user found with that NeupID.' };
    }
    const recoveryAccountId = userSnapshot.docs[0].data().for;

    // 3. Prevent adding self
    if (recoveryAccountId === ownerAccountId) {
      return {
        success: false,
        error: 'You cannot add yourself as a recovery account.',
      };
    }

    // 4. Check if already added
    const alreadyExistsQuery = query(
      recoveryRef,
      where('ownerAccountId', '==', ownerAccountId),
      where('recoveryAccountId', '==', recoveryAccountId)
    );
    const alreadyExistsSnapshot = await getDocs(alreadyExistsQuery);
    if (!alreadyExistsSnapshot.empty) {
      return { success: false, error: 'This account has already been added.' };
    }

    // 5. Add the new recovery account
    const newDocRef = await addDoc(recoveryRef, {
      ownerAccountId: ownerAccountId,
      recoveryAccountId: recoveryAccountId,
      recoveryNeupId: neupId,
      status: 'pending', // Default status
      createdAt: serverTimestamp(),
    });

    const profile = await getUserProfile(recoveryAccountId);

    const newAccountData: RecoveryAccount = {
      id: newDocRef.id,
      recoveryAccountId,
      recoveryNeupId: neupId,
      displayName:
        profile?.nameDisplay ||
        `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() ||
        neupId,
      displayPhoto: profile?.accountPhoto,
      status: 'pending',
    };

    revalidatePath('/manage/security/account');
    return { success: true, newAccount: newAccountData };
  } catch (error) {
    await logError('database', error, 'addRecoveryAccount');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

// Removes a recovery account.
export async function removeRecoveryAccount(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const canRemove = await checkPermissions(['security.recovery_accounts.remove']);
  if (!canRemove) return { success: false, error: 'Permission denied.' };

  const ownerAccountId = await getPersonalAccountId();
  if (!ownerAccountId) {
    return { success: false, error: 'User not authenticated.' };
  }

  try {
    const docRef = doc(db, 'recovery_contacts', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().ownerAccountId !== ownerAccountId) {
      return { success: false, error: 'Permission denied or account not found.' };
    }

    await deleteDoc(docRef);

    revalidatePath('/manage/security/account');
    return { success: true };
  } catch (error) {
    await logError('database', error, `removeRecoveryAccount: ${id}`);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}