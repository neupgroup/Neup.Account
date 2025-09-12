
'use server';

import { db } from './firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { logError } from './logger';
import { getActiveAccountId, getPersonalAccountId } from './auth-actions';

// --- Types ---
export type UserProfile = {
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  nameDisplay?: string;
  accountPhoto?: string;
  gender?: string; // 'male', 'female', 'prefer_not_to_say', 'c.custom'
  dateBirth?: string; // ISO string
  nationality?: string;
  isLegalEntity?: boolean;
  nameLegal?: string;
  registrationId?: string;
  countryOfOrigin?: string;
  dateEstablished?: string; // ISO string
  neupIdPrimary?: string; // Added for convenience
  verified?: boolean; // Added for convenience
  accountType?: string;
};

export type UserContacts = {
  primaryPhone?: string;
  secondaryPhone?: string;
  permanentLocation?: string;
  currentLocation?: string;
  workLocation?: string;
  otherLocation?: string;
};

// --- User Data Fetching ---

export async function getUserProfile(
  accountId?: string
): Promise<UserProfile | null> {
  const idToFetch = accountId || (await getActiveAccountId());
  if (!idToFetch) return null;
  try {
    const accountRef = doc(db, 'account', idToFetch);
    const accountDoc = await getDoc(accountRef);
    
    if (accountDoc.exists()) {
      const accountData = accountDoc.data();
      
      const serializedData: UserProfile = {
        ...accountData,
        dateBirth: accountData.dateBirth?.toDate?.().toISOString() || accountData.dateBirth || null,
        dateEstablished: accountData.dateEstablished?.toDate?.().toISOString() || accountData.dateEstablished || null,
      };

      // Ensure accountType is part of the returned profile
      serializedData.accountType = accountData.accountType || 'individual';

      return serializedData;
    }
    return null;
  } catch (error) {
    await logError('database', error, `getUserProfile: ${idToFetch}`);
    return null;
  }
}

export async function getAccountType(accountId?: string): Promise<string | null> {
    const profile = await getUserProfile(accountId);
    return profile?.accountType || null;
}


export async function getUserContacts(
  accountId?: string
): Promise<UserContacts> {
  const idToFetch = accountId || (await getActiveAccountId());
  if (!idToFetch) return {};
  try {
    const contactsRef = collection(db, 'contact');
    const q = query(contactsRef, where('account_id', '==', idToFetch));
    const querySnapshot = await getDocs(q);

    const contacts: UserContacts = {};
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.contact_type) {
        contacts[data.contact_type as keyof UserContacts] = data.value;
      }
    });
    return contacts;
  } catch (error) {
    await logError('database', error, `getUserContacts: ${idToFetch}`);
    return {};
  }
}

export async function getUserNeupIds(accountId?: string): Promise<string[]> {
  const idToFetch = accountId || (await getActiveAccountId());
  if (!idToFetch) return [];
  try {
    const neupidsRef = collection(db, 'neupid');
    const q = query(neupidsRef, where('for', '==', idToFetch));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.id);
  } catch (error) {
    await logError('database', error, `getUserNeupIds: ${idToFetch}`);
    return [];
  }
}

// --- Permissions ---

export async function getUserPermissions(accountId?: string, appId?: string): Promise<string[]> {
  const activeId = accountId || (await getActiveAccountId());
  if (!activeId) return [];

  const personalId = await getPersonalAccountId();
  const isManaging = activeId !== personalId;

  try {
    const permitRef = collection(db, 'permit');
    const queries = [];

    // If managing another account, fetch permissions *for* that account.
    if (isManaging && personalId) {
        queries.push(query(permitRef, 
            where('account_id', '==', personalId),
            where('target_account', '==', activeId),
            where('for_self', '==', false),
            where('is_root', '==', false)
        ));
    } else {
        // Otherwise, find the personal account's own root and self permissions.
        queries.push(query(permitRef, where('account_id', '==', activeId), where('for_self', '==', true)));
        queries.push(query(permitRef, where('account_id', '==', activeId), where('is_root', '==', true)));
    }

    const snapshots = await Promise.all(queries.map(q => getDocs(q)));
    
    const permissionIds = new Set<string>();
    const restrictionIds = new Set<string>();

    snapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
            const data = doc.data();
            (data.permission || []).forEach((id: string) => permissionIds.add(id));
            (data.restrictions || []).forEach((id: string) => restrictionIds.add(id));
        });
    });

    const finalPermissionSetIds = Array.from(permissionIds).filter(id => !restrictionIds.has(id));

    if (finalPermissionSetIds.length === 0) return [];
    
    const permissionCollection = collection(db, 'permission');
    let permissionQueryConstraints = [where('__name__', 'in', finalPermissionSetIds)];

    // If an appId is provided, filter the permission sets by that app ID.
    if (appId) {
      permissionQueryConstraints.push(where('app_id', '==', appId));
    }

    const permissionDocsQuery = query(permissionCollection, ...permissionQueryConstraints);
    const permissionDocsSnapshot = await getDocs(permissionDocsQuery);

    const allAccessStrings = new Set<string>();
    permissionDocsSnapshot.forEach((doc) => {
      (doc.data().access || []).forEach((access: string) =>
        allAccessStrings.add(access)
      );
    });

    return Array.from(allAccessStrings);
  } catch (error) {
    await logError('database', error, `getUserPermissions for ${activeId}`);
    return [];
  }
}


export async function checkPermissions(
  requiredPermissions: string[],
  appId?: string
): Promise<boolean> {
  const accountId = await getActiveAccountId();
  if (!accountId) return false;
  if (!requiredPermissions || requiredPermissions.length === 0) return true;

  // Pass the appId to the underlying function if it exists
  const userPermissions = await getUserPermissions(accountId, appId);
  const userPermissionSet = new Set(userPermissions);

  return requiredPermissions.every((p) => userPermissionSet.has(p));
}

// --- Validation ---

export async function validateNeupId(neupId: string): Promise<{ success: boolean; error?: string }> {
    if (!neupId || neupId.length < 3) {
        return { success: false, error: "NeupID must be at least 3 characters." };
    }

    try {
        const neupidRef = doc(db, 'neupid', neupId);
        const neupidDoc = await getDoc(neupidRef);

        if (!neupidDoc.exists()) {
            return { success: false, error: "NeupID not found." };
        }

        const accountId = neupidDoc.data().for;
        const accountRef = doc(db, 'account', accountId);
        const accountDoc = await getDoc(accountRef);

        if (!accountDoc.exists()) {
            return { success: false, error: "Associated account does not exist." };
        }

        const accountData = accountDoc.data();
        if (accountData.accountType === 'brand' || accountData.accountType === 'branch') {
             return { success: false, error: "Brand accounts can't be signed in." };
        }
        
        if (accountData.accountStatus === 'deletion_requested') {
            return { success: false, error: "pending_deletion" };
        }

        if (accountData.accountStatus === 'blocked') {
             const block = accountData.block;
             if (block && (block.is_permanent || (block.until && block.until.toDate() > new Date()))) {
                return { success: false, error: "This account has been blocked." };
             }
        }

        return { success: true };

    } catch(e) {
        await logError('database', e, `validateNeupId for ${neupId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function checkNeupIdAvailability(neupId: string): Promise<{ available: boolean }> {
    const lowerNeupId = neupId.toLowerCase();
    if (!lowerNeupId || lowerNeupId.length < 3) {
        return { available: false };
    }
    try {
        const docRef = doc(db, 'neupid', lowerNeupId);
        const docSnap = await getDoc(docRef);
        return { available: !docSnap.exists() };
    } catch (error) {
        await logError('database', error, `checkNeupIdAvailability: ${lowerNeupId}`);
        return { available: false }; // Fail safe
    }
}

export async function isRootUser(accountId: string): Promise<boolean> {
    if (!accountId) return false;
    try {
        const permitQuery = query(
            collection(db, 'permit'),
            where('account_id', '==', accountId),
            where('is_root', '==', true)
        );
        const snapshot = await getDocs(permitQuery);
        return !snapshot.empty;
    } catch (error) {
        await logError('database', error, `isRootUser check for ${accountId}`);
        return false;
    }
}
