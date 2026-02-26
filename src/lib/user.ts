'use server';

import prisma from '@/lib/prisma';
import { logError } from './logger';
import { getActiveAccountId, getPersonalAccountId } from './auth-actions';
import { encodePermissions } from './crypto';
import { PERMISSION_SET } from './permissions';


// --- Types ---
export type UserProfile = {
  nameFirst?: string;
  nameMiddle?: string;
  nameLast?: string;
  nameDisplay?: string;
  displayName?: string;
  accountPhoto?: string;
  gender?: string; // 'male', 'female', 'prefer_not_to_say', 'c.custom'
  dateBirth?: string; // ISO string
  dateCreated?: string; // ISO string
  nationality?: string;
  isLegalEntity?: boolean;
  nameLegal?: string;
  registrationId?: string;
  countryOfOrigin?: string;
  dateEstablished?: string; // ISO string
  neupIdPrimary?: string; // Added for convenience
  verified?: boolean; // Added for convenience
  accountType?: string;
  permit?: string;
  pro?: boolean;
};

export type EncodedPermissions = {
  encoded: string;
  publicKey: string;
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
    const account = await prisma.account.findUnique({
      where: { id: idToFetch },
    });
    
    if (account) {
      const serializedData: UserProfile = {
        nameFirst: account.nameFirst || undefined,
        nameMiddle: account.nameMiddle || undefined,
        nameLast: account.nameLast || undefined,
        nameDisplay: account.nameDisplay || undefined,
        displayName: account.displayName || undefined,
        accountPhoto: account.accountPhoto || undefined,
        gender: account.gender || undefined,
        dateBirth: account.dateBirth?.toISOString() || undefined,
        dateCreated: account.dateCreated?.toISOString() || undefined,
        nationality: account.nationality || undefined,
        isLegalEntity: account.isLegalEntity || undefined,
        nameLegal: account.nameLegal || undefined,
        registrationId: account.registrationId || undefined,
        countryOfOrigin: account.countryOfOrigin || undefined,
        dateEstablished: account.dateEstablished?.toISOString() || undefined,
        neupIdPrimary: account.neupIdPrimary || undefined,
        verified: account.verified || undefined,
        accountType: account.accountType || undefined,
        permit: account.permit || 'default',
        pro: account.pro,
      };

      if (!serializedData.accountPhoto) {
        serializedData.accountPhoto = 'https://neupgroup.com/assets/user.png';
      }

      // Ensure accountType is part of the returned profile
      serializedData.accountType = account.accountType || 'individual';

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
    const contactsList = await prisma.contact.findMany({
      where: { accountId: idToFetch },
    });

    const contacts: UserContacts = {};
    contactsList.forEach((data) => {
      if (data.contactType) {
        contacts[data.contactType as keyof UserContacts] = data.value;
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
    const neupIds = await prisma.neupId.findMany({
      where: { accountId: idToFetch },
    });
    return neupIds.map((doc) => doc.id);
  } catch (error) {
    await logError('database', error, `getUserNeupIds: ${idToFetch}`);
    return [];
  }
}

export async function getUserNeupIdDetails(accountId?: string): Promise<{ id: string; isPrimary: boolean }[]> {
  const idToFetch = accountId || (await getActiveAccountId());
  if (!idToFetch) return [];
  try {
    const neupIds = await prisma.neupId.findMany({
      where: { accountId: idToFetch },
      select: { id: true, isPrimary: true }
    });
    return neupIds;
  } catch (error) {
    await logError('database', error, `getUserNeupIdDetails: ${idToFetch}`);
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
    const account = await prisma.account.findUnique({
      where: { id: activeId },
      select: { permit: true }
    });
    
    if (!account) return [];

    const baseRole = account.permit || 'default';
    let permissionSet = new Set<string>();

    // If not managing another account, start with the base permissions from the account's role
    if (!isManaging) {
      const basePermissions = PERMISSION_SET[baseRole] || (baseRole === 'default' ? (PERMISSION_SET['independent.default'] || []) : []);
      basePermissions.forEach(p => permissionSet.add(p));
    }

    // Fetch relevant permits
    let permits;
    if (isManaging && personalId) {
      permits = await prisma.permit.findMany({
        where: {
          accountId: personalId,
          targetAccountId: activeId,
          forSelf: false,
          isRoot: false
        }
      });
    } else {
      permits = await prisma.permit.findMany({
        where: {
          accountId: activeId,
          OR: [
            { forSelf: true },
            { isRoot: true }
          ]
        }
      });
    }

    // Process modifiers in permit strings
    permits.forEach(permit => {
      const entries = permit.permissions || [];
      entries.forEach(entry => {
        let name = entry;
        let modifier = '';

        if (entry.endsWith('+')) {
          name = entry.slice(0, -1);
          modifier = '+';
        } else if (entry.endsWith('-')) {
          name = entry.slice(0, -1);
          modifier = '-';
        }

        // Resolve name to either a role's permissions or a single permission
        const toApply = PERMISSION_SET[name] || [name];

        if (modifier === '-') {
          toApply.forEach(p => permissionSet.delete(p));
        } else {
          // Both '+' and no modifier result in adding permissions
          toApply.forEach(p => permissionSet.add(p));
        }
      });
    });

    // Filter by appId if provided (if your permissions structure supports appId filtering)
    // For now, returning the full set as requested
    return Array.from(permissionSet);
  } catch (error) {
    await logError('database', error, `getUserPermissions for ${activeId}`);
    return [];
  }
}

export async function getEncodedUserPermissions(accountId?: string, appId?: string): Promise<EncodedPermissions> {
  const permissions = await getUserPermissions(accountId, appId);
  return encodePermissions(permissions);
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
        const neupIdDoc = await prisma.neupId.findUnique({
            where: { id: neupId },
            include: { account: true }
        });

        if (!neupIdDoc) {
            return { success: false, error: "NeupID not found." };
        }

        const account = neupIdDoc.account;

        if (!account) {
            return { success: false, error: "Associated account does not exist." };
        }

        if (account.accountType === 'brand' || account.accountType === 'branch') {
             return { success: false, error: "Brand accounts can't be signed in." };
        }
        
        if (account.accountStatus === 'deletion_requested') {
            return { success: false, error: "pending_deletion" };
        }

        if (account.accountStatus === 'blocked') {
             const block = account.block as any;
             if (block && (block.is_permanent || (block.until && new Date(block.until) > new Date()))) {
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
        const count = await prisma.neupId.count({
            where: { id: lowerNeupId }
        });
        return { available: count === 0 };
    } catch (error) {
        await logError('database', error, `checkNeupIdAvailability: ${lowerNeupId}`);
        return { available: false }; // Fail safe
    }
}

export async function isRootUser(accountId: string): Promise<boolean> {
    if (!accountId) return false;
    try {
        const count = await prisma.permit.count({
            where: {
                accountId: accountId,
                isRoot: true
            }
        });
        return count > 0;
    } catch (error) {
        await logError('database', error, `isRootUser check for ${accountId}`);
        return false;
    }
}