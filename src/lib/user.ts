'use server';

import prisma from '@/lib/prisma';
import { logError } from './logger';
import { getActiveAccountId, getPersonalAccountId } from './auth-actions';
import { DEFAULT_PERMISSIONS } from './permissions-config';


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
    let permitType = 'default';

    if (!isManaging) {
        // Use any cast to avoid linter errors if types aren't fully propagated yet
        const account = await prisma.account.findUnique({
            where: { id: activeId },
        });
        
        // Safely access permit with fallback
        const accountData = account as any;
        permitType = accountData?.permit || 'default';

        if (permitType === 'default') {
            return DEFAULT_PERMISSIONS;
        }
    }

    let permits;

    // If managing another account, fetch permissions *for* that account.
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
        // Otherwise, find the personal account's own root and self permissions.
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

    const permissionIds = new Set<string>();
    const restrictionIds = new Set<string>();

    permits.forEach(permit => {
        (permit.permissions || []).forEach((id: string) => permissionIds.add(id));
        (permit.restrictions || []).forEach((id: string) => restrictionIds.add(id));
    });

    const allIdsToFetch = new Set([...permissionIds, ...restrictionIds]);
    
    let addedAccess = new Set<string>();
    let removedAccess = new Set<string>();

    if (allIdsToFetch.size > 0) {
        const permissionDocs = await prisma.permission.findMany({
            where: {
                id: { in: Array.from(allIdsToFetch) },
                ...(appId ? { appId: appId } : {})
            }
        });
        
        const docMap = new Map();
        // Also map the type for each permission
        const typeMap = new Map();
        permissionDocs.forEach(doc => {
            docMap.set(doc.id, doc.access || []);
            typeMap.set(doc.id, doc.type || 'addition');
        });

        permissionIds.forEach(id => {
            const access = docMap.get(id);
            const type = typeMap.get(id);
            
            if (access) {
                if (type === 'addition') {
                    access.forEach((a: string) => addedAccess.add(a));
                } else if (type === 'reduction') {
                    access.forEach((a: string) => removedAccess.add(a));
                }
            }
        });

        // We still respect restrictions array from permit as reduction for backward compatibility
        // or if it's explicitly used as a restriction list.
        restrictionIds.forEach(id => {
            const access = docMap.get(id);
            if (access) access.forEach((a: string) => removedAccess.add(a));
        });
    }

    let finalPermissions: Set<string>;

    if (!isManaging) {
         if (permitType === 'default') {
             return DEFAULT_PERMISSIONS;
         } else if (permitType === 'addition') {
             // For addition type: Start with Default, add Additions.
             // (Reductions are ignored here based on 'addition' type definition, but let's be safe and apply reductions if any exist)
             // The prompt says: "if the addition exists it means the user has added permissions"
             // It doesn't explicitly say ignore reductions, but 'addition' implies only additions.
             // However, to be robust, usually 'addition' just means "base + extra".
             // If there are 'reduction' permissions linked, should we apply them?
             // Prompt: "if the addition exists it means the user has added permissions"
             // Prompt: "if the reduction means the user has reduced permission set"
             // Prompt: "addition&reduction means some permissions added and some reduced"
             
             // So for 'addition', we strictly add.
             finalPermissions = new Set([...DEFAULT_PERMISSIONS, ...addedAccess]);
         } else if (permitType === 'reduction') {
             // For reduction: Start with Default, remove Reductions.
             // (Additions are ignored)
             finalPermissions = new Set(DEFAULT_PERMISSIONS.filter(p => !removedAccess.has(p)));
         } else if (permitType === 'addition_reduction') {
             // For both: Start with Default, add Additions, remove Reductions.
             const withAddition = [...DEFAULT_PERMISSIONS, ...addedAccess];
             finalPermissions = new Set(withAddition.filter(p => !removedAccess.has(p)));
         } else {
             // Fallback
             finalPermissions = new Set([...DEFAULT_PERMISSIONS]);
         }
    } else {
        // Managing logic (Brand/Dependent context):
        // Prompt: "on brand it means that the user has that permission but that permission has been reduced from his profile."
        // This likely means we take the "Granted" permissions (Additions) and remove "Restricted" ones (Reductions).
        // It doesn't use DEFAULT_PERMISSIONS because managers don't inherently have "self" defaults.
        finalPermissions = new Set([...addedAccess].filter(p => !removedAccess.has(p)));
    }

    return Array.from(finalPermissions);
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