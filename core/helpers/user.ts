'use server';

// Server-side user data layer. Fetches profile, contacts, NeupIDs, and permissions
// for a given account. All functions fall back to the active account if no ID is passed.

import prisma from '@/core/helpers/prisma';
import { logError } from './logger';
import { getActiveAccountId, getPersonalAccountId } from '@/core/auth/verify';
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
  neupIdPrimary?: string;
  verified?: boolean;
  accountType?: string;
  permit?: string;
  pro?: boolean;
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

// Fetches the full profile for an account, including individual and brand sub-profiles.
// nameDisplay prefers the brand name if present, then falls back to account.displayName.
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

      // Fall back to the default avatar if no photo is set
      if (!serializedData.accountPhoto) {
        serializedData.accountPhoto = 'https://neupgroup.com/assets/user.png';
      }

      serializedData.accountType = account.accountType || 'individual';

      return serializedData;
    }
    return null;
  } catch (error) {
    await logError('database', error, `getUserProfile: ${idToFetch}`);
    return null;
  }
}

// Returns just the accountType string for an account.
export async function getAccountType(accountId?: string): Promise<string | null> {
    const profile = await getUserProfile(accountId);
    return profile?.accountType || null;
}

// Fetches all contact entries for an account, keyed by contactType.
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

// Returns all NeupID strings associated with an account.
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

// Returns NeupID strings with their isPrimary flag.
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

// Resolves the full permission set for an account by combining the base role permissions
// with any permit modifiers (+ to add, - to remove) stored in the permit table.
// If the user is managing another account, only delegated permits are applied (no base role).
export async function getUserPermissions(accountId?: string, appId?: string): Promise<string[]> {
  const activeId = accountId || (await getActiveAccountId());
  if (!activeId) return [];

  const personalId = await getPersonalAccountId();
  // isManaging is true when the active account differs from the personal account
  const isManaging = activeId !== personalId;

  try {
    const account = await prisma.account.findUnique({
      where: { id: activeId },
      select: { accountType: true }
    });
    
    if (!account) return [];

    const baseRole = account.accountType === 'dependent' ? 'dependent.full' : 'independent.default';
    let collectedPermissions = new Set<string>();

    // Only apply the base role when not managing — managing context uses delegated permits only
    if (!isManaging) {
      const basePermissions = PERMISSION_SET[baseRole] || [];
      basePermissions.forEach(p => collectedPermissions.add(p));
    }

    // Fetch the relevant permits depending on whether we're in a managing context
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

    // Apply permit entries — a trailing '+' adds, '-' removes, no modifier adds
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

        // A name can refer to a named role (resolved via PERMISSION_SET) or a single permission
        const toApply = PERMISSION_SET[name] || [name];

        if (modifier === '-') {
          toApply.forEach(p => collectedPermissions.delete(p));
        } else {
          toApply.forEach(p => collectedPermissions.add(p));
        }
      });
    });

    // If an appId is provided, also include any portfolio roles the account holds for that app
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

    return Array.from(collectedPermissions);
  } catch (error) {
    await logError('database', error, `getUserPermissions for ${activeId}`);
    return [];
  }
}

// Returns true if the active account has all of the required permissions.
export async function checkPermissions(
  requiredPermissions: string[],
  appId?: string
): Promise<boolean> {
  const accountId = await getActiveAccountId();
  if (!accountId) return false;
  if (!requiredPermissions || requiredPermissions.length === 0) return true;

  const userPermissions = await getUserPermissions(accountId, appId);
  const permissionsSet = new Set(userPermissions);

  return requiredPermissions.every((p) => permissionsSet.has(p));
}


// --- Validation ---

// Validates that a NeupID exists, is associated with a valid account,
// and that the account is not blocked, deleted, or a brand/branch type.
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

        // Brand and branch accounts cannot sign in directly
        if (account.accountType === 'brand' || account.accountType === 'branch') {
             return { success: false, error: "Brand accounts can't be signed in." };
        }
        
        if (account.status === 'deletion_requested') {
            return { success: false, error: "pending_deletion" };
        }

        if (account.status === 'blocked') {
             const details = account.details as Record<string, any> | null;
             const block = details?.block;
             // Check for permanent block or a time-limited block that hasn't expired
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

// Returns whether a NeupID is available for registration.
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
        return { available: false };
    }
}

// Returns true if the account has a root-level permit in the database.
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
