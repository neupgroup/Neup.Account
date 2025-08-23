

"use server"

import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, limit, arrayRemove } from 'firebase/firestore';
import { logError } from './logger';
import { getActiveAccountId as getActiveAccountIdFromServer, getPersonalAccountId as getPersonalAccountIdFromServer } from './auth-actions';

export type UserProfile = {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    displayName?: string;
    displayPhoto?: string;
    gender?: string; // Can be 'male', 'female', 'prefer_not_to_say', or 'c.customvalue'
    dob?: string; // This will be an ISO string from Firestore
    nationality?: string;
    neupId?: string;
    isLegalEntity?: boolean;
    legalName?: string;
    registrationId?: string;
    countryOfOrigin?: string;
    registeredOn?: string; // ISO string
};

export type UserContacts = {
    primaryPhone?: string;
    secondaryPhone?: string;
    permanentLocation?: string;
    currentLocation?: string;
};

// This is the shape of the object stored in Firestore
export type WarningObject = {
    message: string;
    persistence: 'dismissable' | 'untildays' | 'permanent';
    issuedBy: string; // adminId
    issuedOn: string; // ISO date string
    reason: string;
    expiresOn: string | null; // ISO date string, optional
    noticeType: 'general' | 'success' | 'warning' | 'error';
};

// This is the simplified version passed to the client
export type UserWarning = {
    id: string; // A unique identifier for client-side state
    message: string;
    persistence: 'dismissable' | 'untildays' | 'permanent';
    noticeType: 'general' | 'success' | 'warning' | 'error';
};

export async function getAccountType(accountId?: string): Promise<string | null> {
    const idToFetch = accountId || await getActiveAccountIdFromServer();
    if (!idToFetch) return null;
    try {
        const typeRef = doc(db, 'account', idToFetch);
        const typeDoc = await getDoc(typeRef);

        if (typeDoc.exists()) {
            return typeDoc.data().type || 'individual'; // default to individual if type is missing
        }
        // If no type document, it's likely an older account, default to individual
        return 'individual';

    } catch (error) {
        await logError('database', error, `getAccountType: ${idToFetch}`);
        return null;
    }
}


export async function getUserProfile(accountId?: string): Promise<UserProfile | null> {
    const idToFetch = accountId || await getActiveAccountIdFromServer();
    if (!idToFetch) return null;
    try {
        const profileRef = doc(db, 'profile', idToFetch);
        const profileDoc = await getDoc(profileRef);

        if (profileDoc.exists()) {
            const data = profileDoc.data();
            
            // The `createdAt` field is a Firestore Timestamp object, which is not serializable
            // and cannot be passed from Server to Client Components. We remove it here.
            if (data.createdAt) {
                delete data.createdAt;
            }
            
            return data as UserProfile;
        }
        return null;
    } catch (error) {
        await logError('database', error, `getUserProfile: ${idToFetch}`);
        throw new Error("Could not fetch user profile.");
    }
}

export async function getUserContacts(accountId?: string): Promise<UserContacts> {
    const idToFetch = accountId || await getActiveAccountIdFromServer();
    if (!idToFetch) return {};
    try {
        const contactsRef = collection(db, 'contact');
        const q = query(contactsRef, where('account_id', '==', idToFetch));
        const querySnapshot = await getDocs(q);

        const contacts: UserContacts = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.contact_type) {
                contacts[data.contact_type as keyof UserContacts] = data.value;
            }
        });

        return contacts;
    } catch (error) {
        await logError('database', error, `getUserContacts: ${idToFetch}`);
        throw new Error("Could not fetch user contacts.");
    }
}

export async function getUserNeupIds(accountId?: string): Promise<string[]> {
    const idToFetch = accountId || await getActiveAccountIdFromServer();
    if (!idToFetch) return [];
    try {
        const neupidsRef = collection(db, 'neupid');
        const q = query(neupidsRef, where('for', '==', idToFetch));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
        await logError('database', error, `getUserNeupIds: ${idToFetch}`);
        throw new Error("Could not fetch user NeupIDs.");
    }
}

export async function getPersonalAccountId() {
    return getPersonalAccountIdFromServer();
}

export async function getUserPermissions(accountId?: string): Promise<string[]> {
    const idToFetch = accountId || await getActiveAccountIdFromServer();
    if (!idToFetch) return [];
    
    try {
        const accountType = await getAccountType(idToFetch);

        const permitRef = collection(db, 'permit');
        const q = query(permitRef, where('account_id', '==', idToFetch));
        const permitSnapshot = await getDocs(q);

        const customPermissionSetIds = new Set<string>();
        const restrictedPermissionSetIds = new Set<string>();

        permitSnapshot.forEach(doc => {
            const data = doc.data();
            (data.permission || []).forEach((id: string) => customPermissionSetIds.add(id));
            (data.restricted_permission || []).forEach((id: string) => restrictedPermissionSetIds.add(id));
        });

        // Add default permissions for individual accounts
        if (accountType === 'individual') {
             const defaultPermQuery = query(collection(db, 'permission'), where('name', '==', 'individual.default'), limit(1));
             const defaultPermSnap = await getDocs(defaultPermQuery);
             if (!defaultPermSnap.empty) {
                customPermissionSetIds.add(defaultPermSnap.docs[0].id);
             }
        }
        
        // Remove restricted permissions
        const finalPermissionSetIds = Array.from(customPermissionSetIds).filter(id => !restrictedPermissionSetIds.has(id));

        if (finalPermissionSetIds.length === 0) {
            return [];
        }

        const permissionCollection = collection(db, 'permission');
        const permissionDocsQuery = query(permissionCollection, where('__name__', 'in', finalPermissionSetIds));
        const permissionDocsSnapshot = await getDocs(permissionDocsQuery);

        const allAccessStrings = new Set<string>();
        permissionDocsSnapshot.forEach(doc => {
            const accessList = doc.data().access || [];
            if (Array.isArray(accessList)) {
                accessList.forEach((access: string) => allAccessStrings.add(access));
            }
        });
        
        return Array.from(allAccessStrings);

    } catch (error) {
        await logError('database', error, `getUserPermissions for ${idToFetch}`);
        return [];
    }
}


export async function checkPermissions(requiredPermissions: string[]): Promise<boolean> {
    const accountId = await getActiveAccountIdFromServer();
    if (!accountId) return false;

    // A user with no required permissions should always pass.
    if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
    }

    const userPermissions = await getUserPermissions(accountId);
    const userPermissionSet = new Set(userPermissions);

    return requiredPermissions.every(p => userPermissionSet.has(p));
}
