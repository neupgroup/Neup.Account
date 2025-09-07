
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { getUserProfile, checkPermissions, getUserNeupIds, isRootUser } from '@/lib/user';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { deleteUserAccount } from '@/actions/root/user-actions';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { z } from 'zod';

export type DeletionRequest = {
  accountId: string;
  userFullName: string;
  userNeupId: string;
  requestedAt: string;
};

const requestByAdminSchema = z.object({
    reason: z.string().min(10, "A reason of at least 10 characters is required."),
});

export async function getDeletionRequests(): Promise<DeletionRequest[]> {
  const canView = await checkPermissions(['root.requests.view']);
  if (!canView) return [];

  try {
    const accountsRef = collection(db, 'account');
    const q = query(
      accountsRef,
      where('status', '==', 'deletion_requested')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return [];
    }

    const requests = await Promise.all(
      querySnapshot.docs.map(async (docSnap) => {
        const accountId = docSnap.id;
        const [profile, neupIds] = await Promise.all([
          getUserProfile(accountId),
          getUserNeupIds(accountId),
        ]);

        // Attempt to get the request date from the account_status collection
        const statusQuery = query(
            collection(db, 'account_status'),
            where('account_id', '==', accountId),
            where('status', '==', 'deletion_requested')
        );
        const statusSnapshot = await getDocs(statusQuery);
        const requestedAt = statusSnapshot.docs[0]?.data().from_date?.toDate()?.toLocaleDateString() || 'N/A';

        return {
          accountId,
          userFullName:
            profile?.displayName ||
            `${profile?.firstName} ${profile?.lastName}`.trim() ||
            'Unknown User',
          userNeupId: neupIds[0] || 'N/A',
          requestedAt,
        };
      })
    );
    return requests;
  } catch (error) {
    await logError('database', error, 'getDeletionRequests');
    return [];
  }
}

export async function getDeletionStatus(accountId: string): Promise<{status: 'none' | 'pending' | 'deleted' | 'is_root', requestedAt?: string | null}> {
    try {
        const isTargetRoot = await isRootUser(accountId);
        if (isTargetRoot) {
            return { status: 'is_root' };
        }

        const accountRef = doc(db, 'account', accountId);
        const accountDoc = await getDoc(accountRef);

        if (!accountDoc.exists()) {
            return { status: 'deleted' };
        }

        const status = accountDoc.data().status;
        if (status === 'deletion_requested') {
            const statusQuery = query(
                collection(db, 'account_status'),
                where('account_id', '==', accountId),
                where('status', '==', 'deletion_requested')
            );
            const statusSnapshot = await getDocs(statusQuery);
            const requestedAt = statusSnapshot.docs[0]?.data().from_date?.toDate()?.toLocaleDateString() || null;
            return { status: 'pending', requestedAt };
        }

        return { status: 'none' };
    } catch (error) {
        await logError('database', error, `getDeletionStatus for ${accountId}`);
        return { status: 'none' };
    }
}


export async function approveAccountDeletion(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
    const canApprove = await checkPermissions(['root.account.delete']);
    if (!canApprove) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    try {
        const result = await deleteUserAccount(accountId);
        if (result.success) {
            revalidatePath('/manage/root/requests/deletion');
             revalidatePath(`/manage/root/accounts/${accountId}`);
            return { success: true };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
         await logError('database', error, `approveAccountDeletion: ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


export async function cancelAccountDeletion(
  accountId: string
): Promise<{ success: boolean; error?: string }> {
    const canCancel = await checkPermissions(['root.requests.approve']);
    if (!canCancel) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Admin not authenticated.'};

    try {
        const batch = writeBatch(db);
        const accountRef = doc(db, 'account', accountId);
        batch.update(accountRef, { status: 'active' });

        // Find and update the status log
        const statusQuery = query(
            collection(db, 'account_status'),
            where('account_id', '==', accountId),
            where('status', '==', 'deletion_requested')
        );
        const statusSnapshot = await getDocs(statusQuery);
        if (!statusSnapshot.empty) {
            const statusDocRef = statusSnapshot.docs[0].ref;
            batch.update(statusDocRef, {
                status: 'request_cancelled',
                remarks: `Request cancelled by admin ${adminId}.`
            });
        }
        
        await batch.commit();

        await logActivity(accountId, 'Account Deletion Cancelled by Admin', 'Success', undefined, adminId);
        revalidatePath('/manage/root/requests/deletion');
        revalidatePath(`/manage/root/accounts/${accountId}/deletion`);
        return { success: true };
    } catch (error) {
        await logError('database', error, `cancelAccountDeletion: ${accountId}`);
        return { success: false, error: 'Failed to cancel deletion request.' };
    }
}


export async function requestAccountDeletionByAdmin(accountId: string, data: z.infer<typeof requestByAdminSchema>): Promise<{ success: boolean; error?: string; }> {
    const canDelete = await checkPermissions(['root.account.delete']);
    if (!canDelete) {
        return { success: false, error: "Permission denied." };
    }
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.'};
    
    const validation = requestByAdminSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.reason?.[0] };
    }

    try {
        const isTargetRoot = await isRootUser(accountId);
        if (isTargetRoot) {
            return { success: false, error: "Root user accounts cannot be deleted this way." };
        }

        const accountRef = doc(db, 'account', accountId);
        const batch = writeBatch(db);

        batch.update(accountRef, { status: 'deletion_requested' });

        const statusLogRef = doc(collection(db, 'account_status'));
        batch.set(statusLogRef, {
            account_id: accountId,
            status: 'deletion_requested',
            remarks: `Admin initiated deletion. Reason: ${validation.data.reason}`,
            from_date: serverTimestamp(),
            more_info: `Request initiated by admin: ${adminId}.`
        });

        await batch.commit();

        await logActivity(accountId, "Account Deletion Requested by Admin", "Alert", undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/deletion`);
        return { success: true };

    } catch (error) {
        await logError("database", error, `requestAccountDeletionByAdmin: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
