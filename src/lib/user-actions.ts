
"use server"

import prisma from './prisma';
import { logError } from './logger';
import { getActiveAccountId as getActiveAccountIdFromServer, getPersonalAccountId as getPersonalAccountIdFromServer } from './auth-actions';

export type UserProfile = {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    displayName?: string;
    displayPhoto?: string;
    gender?: string; // Can be 'male', 'female', 'prefer_not_to_say', or 'c.customvalue'
    dob?: string; // This will be an ISO string
    nationality?: string;
    neupId?: string;
    isLegalEntity?: boolean;
    legalName?: string;
    registrationId?: string;
    countryOfOrigin?: string;
    registeredOn?: string; // ISO string
    pro?: boolean;
};

export type UserContacts = {
    primaryPhone?: string;
    secondaryPhone?: string;
    permanentLocation?: string;
    currentLocation?: string;
};

// This is the shape of the warning object
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
        const account = await prisma.account.findUnique({
            where: { id: idToFetch },
            select: { accountType: true }
        });

        if (account) {
            return account.accountType || 'individual';
        }
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
        const account = await prisma.account.findUnique({
            where: { id: idToFetch }
        });

        if (account) {
            return {
                firstName: account.nameFirst || undefined,
                middleName: account.nameMiddle || undefined,
                lastName: account.nameLast || undefined,
                displayName: account.nameDisplay || undefined,
                displayPhoto: account.accountPhoto || undefined,
                gender: account.gender || undefined,
                dob: account.dateBirth?.toISOString() || undefined,
                nationality: account.nationality || undefined,
                isLegalEntity: account.isLegalEntity,
                legalName: account.nameLegal || undefined,
                registrationId: account.registrationId || undefined,
                countryOfOrigin: account.countryOfOrigin || undefined,
                registeredOn: account.dateCreated.toISOString(),
                pro: account.pro,
            };
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
        const contactsList = await prisma.contact.findMany({
            where: { accountId: idToFetch }
        });

        const contacts: UserContacts = {};
        contactsList.forEach(c => {
            if (c.contactType) {
                contacts[c.contactType as keyof UserContacts] = c.value;
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
        const neupIds = await prisma.neupId.findMany({
            where: { accountId: idToFetch },
            select: { id: true }
        });
        
        return neupIds.map(n => n.id);
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

        const permits = await prisma.permit.findMany({
            where: { accountId: idToFetch }
        });

        const customPermissionSetIds = new Set<string>();
        const restrictedPermissionSetIds = new Set<string>();

        permits.forEach(p => {
            if (p.permissions && Array.isArray(p.permissions)) {
                p.permissions.forEach(id => customPermissionSetIds.add(id));
            }
            if (p.restrictions && Array.isArray(p.restrictions)) {
                p.restrictions.forEach(id => restrictedPermissionSetIds.add(id));
            }
        });

        // Add default permissions for individual accounts
        if (accountType === 'individual') {
             const defaultPermSet = await prisma.permissionSet.findUnique({
                 where: { name: 'individual.default' }
             });
             if (defaultPermSet) {
                customPermissionSetIds.add(defaultPermSet.id);
             }
        }
        
        // Remove restricted permissions
        const finalPermissionSetIds = Array.from(customPermissionSetIds).filter(id => !restrictedPermissionSetIds.has(id));

        if (finalPermissionSetIds.length === 0) {
            return [];
        }

        // Fetch all permission sets
        const permissionSets = await prisma.permissionSet.findMany({
            where: {
                OR: [
                    { id: { in: finalPermissionSetIds } },
                    { name: { in: finalPermissionSetIds } }
                ]
            }
        });

        // Collect all permission IDs/names from the sets
        const permissionIdsOrNames = new Set<string>();
        permissionSets.forEach(ps => {
            if (ps.permissions && Array.isArray(ps.permissions)) {
                ps.permissions.forEach(p => permissionIdsOrNames.add(p));
            }
        });

        if (permissionIdsOrNames.size === 0) {
            return [];
        }

        // Fetch all permissions
        const permissions = await prisma.permission.findMany({
            where: {
                OR: [
                    { id: { in: Array.from(permissionIdsOrNames) } },
                    { name: { in: Array.from(permissionIdsOrNames) } }
                ]
            }
        });

        // Extract all access strings
        const allAccess = new Set<string>();
        permissions.forEach(p => {
            if (p.access && Array.isArray(p.access)) {
                p.access.forEach(a => allAccess.add(a));
            }
        });

        return Array.from(allAccess);

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

    