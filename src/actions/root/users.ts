

'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  limit,
  writeBatch,
  serverTimestamp,
  setDoc,
  orderBy,
} from 'firebase/firestore';
import { getUserNeupIds, getUserProfile as fetchUserProfile, checkPermissions, getAccountType } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/log-actions';

import type {
  UserDetails,
  UserActivityLog,
  UserPermissions,
  UserDashboardStats,
} from '@/types';

// Simplified for now, can be expanded later.
export type UserDetailsLimited = {
  accountId: string;
  neupId: string;
  nameDisplay: string;
};

export async function getUserDetails(
  accountId: string
): Promise<UserDetails | null> {
  const [profile, accountType, neupIds] = await Promise.all([
    fetchUserProfile(accountId),
    getAccountType(accountId),
    getUserNeupIds(accountId)
  ]);


  if (!profile) {
    return null;
  }

  return {
    accountId,
    neupId: neupIds.find(id => id === profile.neupIdPrimary) || neupIds[0] || 'N/A',
    profile,
    accountType: accountType || 'individual',
  };
}

export async function getAccountDetails(accountId: string) {
    const accountRef = doc(db, 'account', accountId);
    const accountDoc = await getDoc(accountRef);
    if(accountDoc.exists()) {
        return accountDoc.data();
    }
    return null;
}


export async function getActivity(accountId: string): Promise<UserActivityLog[]> {
    const activityRef = collection(db, 'activity');
    const q = query(activityRef, where('targetAccountId', '==', accountId), orderBy('timestamp', 'desc'), limit(20));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
        const data = doc.data();
        const rawTimestamp = data.timestamp?.toDate() || new Date();
        return {
            id: doc.id,
            action: data.action,
            status: data.status,
            ip: data.ip,
            timestamp: rawTimestamp.toLocaleString(),
            geolocation: data.geolocation,
            rawTimestamp
        }
    }).sort((a, b) => b.rawTimestamp.getTime() - a.rawTimestamp.getTime());
}

export async function getPermissions(accountId: string): Promise<UserPermissions> {
    const permitQuery = query(collection(db, 'permit'), where('account_id', '==', accountId), where('for_self', '==', true));
    const permitSnapshot = await getDocs(permitQuery);
    
    if (permitSnapshot.empty) {
        return { assignedPermissionSetIds: [], restrictedPermissionSetIds: [], allPermissions: [] };
    }

    const permitDoc = permitSnapshot.docs[0];
    const permissionIds: string[] = permitDoc.data().permission || [];
    const restrictionIds: string[] = permitDoc.data().restrictions || [];
    
    const finalPermissionIds = permissionIds.filter(id => !restrictionIds.includes(id));

    if (finalPermissionIds.length === 0) {
        return { assignedPermissionSetIds: permissionIds, restrictedPermissionSetIds: restrictionIds, allPermissions: [] };
    }
    
    const permsRef = collection(db, 'permission');
    const permsQuery = query(permsRef, where('__name__', 'in', finalPermissionIds));
    const permsSnapshot = await getDocs(permsQuery);

    const allPermissions = new Set<string>();
    permsSnapshot.forEach(doc => {
        (doc.data().access || []).forEach((p: string) => allPermissions.add(p));
    });

    return { 
        assignedPermissionSetIds: permissionIds, 
        restrictedPermissionSetIds: restrictionIds, 
        allPermissions: Array.from(allPermissions) 
    };
}

export async function updateUserPermissions(accountId: string, newPermissionIds: string[], newRestrictionIds: string[]): Promise<{success: boolean, error?: string}> {
    const canUpdate = await checkPermissions(['root.permission.edit']);
    if (!canUpdate) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        const permitQuery = query(collection(db, 'permit'), where('account_id', '==', accountId), where('for_self', '==', true), limit(1));
        const permitSnapshot = await getDocs(permitQuery);

        const dataToSet = {
            permission: newPermissionIds,
            restrictions: newRestrictionIds
        };

        if (permitSnapshot.empty) {
            // Document doesn't exist, so create it.
            const newPermitRef = doc(collection(db, 'permit'));
            await setDoc(newPermitRef, {
                ...dataToSet,
                account_id: accountId,
                for_self: true,
                is_root: false,
                created_on: serverTimestamp(),
            });
        } else {
            // Document exists, so update it.
            const permitDocRef = permitSnapshot.docs[0].ref;
            await updateDoc(permitDocRef, dataToSet);
        }
        
        const adminId = await getPersonalAccountId() ?? "";
        await logActivity(accountId, `Permissions updated by root user ${adminId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/permissions`);

        return { success: true };

    } catch (e) {
        console.error("Error updating permissions:", e);
        return { success: false, error: "An unexpected error occurred." };
    }
}


export async function getUserDashboardStats(accountId: string): Promise<UserDashboardStats> {
    const activityRef = collection(db, 'activity');
    const q = query(activityRef, where('targetAccountId', '==', accountId), orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return {
            lastIpAddress: 'N/A',
            lastLocation: 'N/A',
            lastActive: 'N/A',
        };
    }

    const lastActivity = snapshot.docs[0].data();
    return {
        lastIpAddress: lastActivity.ip,
        lastLocation: lastActivity.geolocation || 'N/A',
        lastActive: lastActivity.timestamp?.toDate().toLocaleString() || 'N/A',
    }
}
