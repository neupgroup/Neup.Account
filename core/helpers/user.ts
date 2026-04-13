'use server';

import prisma from '@/core/helpers/prisma';
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
      include: {
        individualProfile: true,
        brandProfile: true,
      },
    });
    
    if (account) {
      const serializedData: UserProfile = {
        nameFirst: account.individualProfile?.firstName || undefined,
        nameMiddle: account.individualProfile?.middleName || undefined,
        nameLast: account.individualProfile?.lastName || undefined,
        nameDisplay: account.brandProfile?.brandName || account.displayName || undefined,
        displayName: account.displayName || undefined,
        accountPhoto: account.displayImage || undefined,
        dateBirth: account.individualProfile?.dateOfBirth?.toISOString() || undefined,
        dateCreated: account.createdAt?.toISOString() || undefined,
        nationality: account.individualProfile?.countryOfResidence || undefined,
        isLegalEntity: account.brandProfile?.isLegalEntity || undefined,
        countryOfOrigin: account.brandProfile?.originCountry || undefined,
        verified: account.isVerified || undefined,
        accountType: account.accountType || undefined,
        permit: 'default',
        pro: false,
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
      select: { accountType: true }
    });
    
    if (!account) return [];

    const baseRole = account.accountType === 'dependent' ? 'dependent.full' : 'independent.default';
    let collectedPermissions = new Set<string>();

    // If not managing another account, start with the base permissions from the account's role
    if (!isManaging) {
      const basePermissions = PERMISSION_SET[baseRole] || [];
      basePermissions.forEach(p => collectedPermissions.add(p));
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
          toApply.forEach(p => collectedPermissions.delete(p));
        } else {
          // Both '+' and no modifier result in adding permissions
          toApply.forEach(p => collectedPermissions.add(p));
        }
      });
    });

    if (appId) {
      const roleRows = await prisma.portfolioRole.findMany({
        where: {
          accountId: activeId,
          portfolio: {
            assets: {
              some: {
                assetId: appId,
                assetType: { in: ['application', 'app'] },
              },
            },
          },
        },
        select: { roleId: true },
      });

      roleRows.forEach((row) => {
        collectedPermissions.add(row.roleId);
      });
    }

    // Filter by appId if provided (if your permissions structure supports appId filtering)
    // For now, returning the full set as requested
    return Array.from(collectedPermissions);
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
  const permissionsSet = new Set(userPermissions);

  return requiredPermissions.every((p) => permissionsSet.has(p));
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
        
           if (account.status === 'deletion_requested') {
            return { success: false, error: "pending_deletion" };
        }

           if (account.status === 'blocked') {
             const details = account.details as Record<string, any> | null;
             const block = details?.block;
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
