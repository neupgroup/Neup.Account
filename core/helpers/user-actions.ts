
"use server"

import prisma from './prisma';
import { logError } from './logger';
import { getActiveAccountId as getActiveAccountIdFromServer, getPersonalAccountId as getPersonalAccountIdFromServer } from '@/core/auth/verify';

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
            where: { id: idToFetch },
            include: {
                individualProfile: true,
                brandProfile: true,
            }
        });

        if (account) {
            return {
                firstName: account.individualProfile?.firstName || undefined,
                middleName: account.individualProfile?.middleName || undefined,
                lastName: account.individualProfile?.lastName || undefined,
                displayName: account.brandProfile?.brandName || account.displayName || undefined,
                displayPhoto: account.displayImage || undefined,
                dob: account.individualProfile?.dateOfBirth?.toISOString() || undefined,
                nationality: account.individualProfile?.countryOfResidence || undefined,
                isLegalEntity: account.brandProfile?.isLegalEntity,
                countryOfOrigin: account.brandProfile?.originCountry || undefined,
                registeredOn: account.createdAt.toISOString(),
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

import { getUserPermissions as fetchUserPermissions } from './user';

export async function getUserPermissions(accountId?: string): Promise<string[]> {
    return fetchUserPermissions(accountId);
}


export async function checkPermissions(requiredPermissions: string[]): Promise<boolean> {
    const accountId = await getActiveAccountIdFromServer();
    if (!accountId) return false;

    // A user with no required permissions should always pass.
    if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
    }

    const userPermissions = await getUserPermissions(accountId);
    const permissionsSet = new Set(userPermissions);

    return requiredPermissions.every(p => permissionsSet.has(p));
}

    