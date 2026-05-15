'use server';

import prisma from '@/core/helpers/prisma';
import { getActiveAccountId, getPersonalAccountId } from '@/core/auth/verify';
import { getUserProfile, getUserNeupIds, getAccountType, getAccountPermission, checkPermissions } from '@/services/user';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logActivity } from '@/services/log-actions';

export type Permission = {
  id: string;
  name: string;
};

export type UserAccess = {
  permitId: string;
  userId: string;
  displayName: string;
  accountPhoto?: string;
  permissions: string[];
  status: 'pending' | 'approved' | 'rejected';
  isSelf: boolean;
};

/** One entry per grant row — used to render one card per role on the access list page. */
export type UserAccessGrant = {
  permitId: string;
  userId: string;
  displayName: string;
  accountPhoto?: string;
  isSelf: boolean;
  role: {
    id: string;
    name: string;
    description?: string;
  };
};

export type AccessDetails = {
  permitId: string;
  grantedTo: {
    id: string;
    name: string;
    neupId: string;
  };
  /** The account whose resources are being accessed (ownerAccountId). */
  account: {
    id: string;
    name: string;
  };
  /** Set when this grant is scoped to a portfolio. */
  portfolio: {
    id: string;
    name: string;
    description?: string;
  } | null;
  /** The role assigned to this grant. */
  role: {
    id: string;
    name: string;
    description?: string;
  };
};

/**
 * Function getMasterPermissions.
 */
export async function getMasterPermissions(): Promise<Permission[]> {
    const capabilities = await prisma.authzCapability.findMany({
        where: { appId: 'neup.account' },
        select: { name: true },
        orderBy: { name: 'asc' },
    });

    const unique = Array.from(new Set(capabilities.map(c => c.name)));
    return unique.map(name => ({ id: name, name }));
}


/**
 * Type Invitation.
 */
export type Invitation = {
    permitId: string;
    grantedBy: {
        name: string;
        neupId: string;
        accountPhoto?: string;
    };
    grantedOn: string;
}

const addAccessSchema = z.object({
    neupId: z.string().min(3, "NeupID must be at least 3 characters."),
});

const statusOrder: Record<UserAccess['status'], number> = {
    'approved': 1,
    'pending': 2,
    'rejected': 3,
};


/**
 * Function getAccessList.
 * Returns only grants that are NOT associated with a portfolio.
 * Multiple grants for the same account are merged into a single entry with all permissions combined.
 */
export async function getAccessList(accountId: string): Promise<UserAccess[]> {
  try {
    const grants = await prisma.authzAccountAccessGrant.findMany({
      where: {
        ownerAccountId: accountId,
        appId: 'neup.account',
        portfolioId: null,
      },
    });

    // Group grants by targetAccountId, merging permissions
    const grouped = new Map<string, { roleIds: string[]; isSelf: boolean }>();
    for (const grant of grants) {
      const existing = grouped.get(grant.targetAccountId);
      if (existing) {
        existing.roleIds.push(grant.roleId);
      } else {
        grouped.set(grant.targetAccountId, {
          roleIds: [grant.roleId],
          isSelf: grant.ownerAccountId === grant.targetAccountId,
        });
      }
    }

    // Resolve profiles for each unique account
    const accessList = await Promise.all(
      Array.from(grouped.entries()).map(async ([targetAccountId, { roleIds, isSelf }]) => {
        const userProfile = await getUserProfile(targetAccountId);
        if (!userProfile) return null;

        // Use the grant id of the first grant as a stable key for linking to /access/[id]
        const firstGrant = grants.find((g) => g.targetAccountId === targetAccountId);
        if (!firstGrant) return null;

        return {
          permitId: firstGrant.id,
          userId: targetAccountId,
          displayName:
            userProfile.nameDisplay ||
            `${userProfile.nameFirst ?? ''} ${userProfile.nameLast ?? ''}`.trim(),
          accountPhoto: userProfile.accountPhoto,
          permissions: roleIds,
          status: 'approved' as const,
          isSelf,
        };
      })
    );

    return accessList.filter((u): u is NonNullable<typeof u> => u !== null);

  } catch (error) {
    await logError('database', error, `getAccessList for ${accountId}`);
    return [];
  }
}


/**
 * Function getAccessListByGrant.
 * Returns one entry per grant row (one per role), with role details resolved.
 * Used to render one card per role on the access list page.
 */
export async function getAccessListByGrant(accountId: string): Promise<UserAccessGrant[]> {
  try {
    const grants = await prisma.authzAccountAccessGrant.findMany({
      where: {
        ownerAccountId: accountId,
        appId: 'neup.account',
        portfolioId: null,
      },
      include: {
        role: { select: { id: true, name: true, description: true } },
      },
    });

    const results = await Promise.all(
      grants.map(async (grant) => {
        const userProfile = await getUserProfile(grant.targetAccountId);
        if (!userProfile) return null;

        return {
          permitId: grant.id,
          userId: grant.targetAccountId,
          displayName:
            userProfile.nameDisplay ||
            `${userProfile.nameFirst ?? ''} ${userProfile.nameLast ?? ''}`.trim(),
          accountPhoto: userProfile.accountPhoto,
          isSelf: grant.ownerAccountId === grant.targetAccountId,
          role: {
            id: grant.role.id,
            name: grant.role.name,
            description: grant.role.description ?? undefined,
          },
        };
      })
    );

    return results.filter((u): u is NonNullable<typeof u> => u !== null);
  } catch (error) {
    await logError('database', error, `getAccessListByGrant for ${accountId}`);
    return [];
  }
}


/**
 * Function getAccessDetails.
 */
export async function getAccessDetails(permitId: string): Promise<AccessDetails | null> {
    try {
        const grant = await prisma.authzAccountAccessGrant.findUnique({
          where: { id: permitId },
          include: {
            role: { select: { id: true, name: true, description: true } },
            portfolio: { select: { id: true, name: true, description: true } },
          },
        });

        if (!grant) {
            return null;
        }

        // In authzAccountAccessGrant: ownerAccountId = the account being managed,
        // targetAccountId = the accessor who was granted access (grantedTo).
        const [grantedToProfile, accountProfile, grantedToNeupIds] = await Promise.all([
            getUserProfile(grant.targetAccountId),
            getUserProfile(grant.ownerAccountId),
            getUserNeupIds(grant.targetAccountId),
        ]);

        if (!grantedToProfile || !accountProfile) {
            return null;
        }

        return {
            permitId: grant.id,
            grantedTo: {
                id: grant.targetAccountId,
                name: grantedToProfile.nameDisplay || `${grantedToProfile.nameFirst} ${grantedToProfile.nameLast}`.trim(),
                neupId: grantedToNeupIds[0] || 'N/A',
            },
            account: {
                id: grant.ownerAccountId,
                name: accountProfile.nameDisplay || `${accountProfile.nameFirst} ${accountProfile.nameLast}`.trim(),
            },
            portfolio: grant.portfolio
                ? {
                    id: grant.portfolio.id,
                    name: grant.portfolio.name,
                    description: grant.portfolio.description ?? undefined,
                  }
                : null,
            role: {
                id: grant.role.id,
                name: grant.role.name,
                description: grant.role.description ?? undefined,
            },
        };

    } catch (error) {
        await logError('database', error, `getAccessDetails for ${permitId}`);
        return null;
    }
}


/**
 * Function removeAccess.
 */
export async function removeAccess(permitId: string, geolocation?: string): Promise<{ success: boolean; error?: string }> {
    const currentAccountId = await getActiveAccountId();
     if (!currentAccountId) {
        return { success: false, error: "Not authenticated." };
    }
    
    try {
        const grant = await prisma.authzAccountAccessGrant.findUnique({
          where: { id: permitId }
        });

        if (!grant || grant.ownerAccountId !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }
        
        const removedUserId = grant.targetAccountId;
        await prisma.authzAccountAccessGrant.delete({
          where: { id: permitId }
        });

        await logActivity(currentAccountId, `Revoked access for user ${removedUserId}`, 'Success', undefined, undefined, geolocation);
        
        revalidatePath('/manage/access');
        revalidatePath(`/manage/access/${permitId}`);
        return { success: true };
    } catch (error) {
        await logError('database', error, `removeAccess: ${permitId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


/**
 * Function getDelegatablePermissions.
 */
export async function getDelegatablePermissions(): Promise<Permission[]> {
    const managedAccountId = await getActiveAccountId();
    if (!managedAccountId) return [];

    // Get all permissions the current user has on the active account
    const userPermissions = await getAccountPermission(managedAccountId);
    
    // Convert to Permission objects
    return userPermissions.sort().map(p => ({
        id: p,
        name: p
    }));
}


/**
 * Function updatePermissions.
 */
export async function updatePermissions(permitId: string, newPermissionIds: string[], geolocation?: string): Promise<{ success: boolean, error?: string}> {
    const currentAccountId = await getActiveAccountId();
    if (!currentAccountId) {
        return { success: false, error: "Not authenticated." };
    }

    const canAdd = await checkPermissions(['security.third_party.add']);
    if (!canAdd) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        const grant = await prisma.authzAccountAccessGrant.findUnique({
          where: { id: permitId }
        });

        if (!grant || grant.ownerAccountId !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }

        // --- Permission Delegation Check ---
        const userResolvedPermissions = await getAccountPermission(currentAccountId);
        const userResolvedPermSet = new Set(userResolvedPermissions);

        const isAllowed = newPermissionIds.every(p => userResolvedPermSet.has(p));
        if (!isAllowed) {
            return { success: false, error: "You are trying to grant permissions you do not possess." };
        }
        // --- End Check ---

        const targetUserId = grant.targetAccountId;

        if (newPermissionIds.length === 0) {
            await prisma.authzAccountAccessGrant.delete({ where: { id: permitId } });
        } else {
            // The new model stores a single roleId per grant; use the first permission as the role.
            await prisma.authzAccountAccessGrant.update({
              where: { id: permitId },
              data: { roleId: newPermissionIds[0] },
            });
        }
        
        await logActivity(currentAccountId, `Updated permissions for user ${targetUserId}`, 'Success', undefined, undefined, geolocation);
        revalidatePath('/manage/access');
        revalidatePath(`/manage/access/${permitId}`);
        return { success: true };

    } catch (error) {
        await logError('database', error, `updatePermissions: ${permitId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}


/**
 * Function grantAccessByNeupId.
 */
export async function grantAccessByNeupId(formData: FormData, geolocation?: string): Promise<{ success: boolean; error?: string; }> {
    const ownerAccountId = await getActiveAccountId();
    if (!ownerAccountId) {
        return { success: false, error: "Not authenticated." };
    }

    const canAdd = await checkPermissions(['security.third_party.add']);
    if (!canAdd) {
        return { success: false, error: 'Permission denied.' };
    }

    const validation = addAccessSchema.safeParse({ neupId: formData.get('neupId') });
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.neupId?.[0] };
    }
    const neupId = validation.data.neupId.toLowerCase();

    try {
        // Find the account to add
        const neupIdRecord = await prisma.neupId.findUnique({
          where: { id: neupId }
        });

        if (!neupIdRecord) {
            return { success: false, error: "No user found with that NeupID." };
        }
        const targetAccountId = neupIdRecord.accountId;

        // Prevent adding self
        if (targetAccountId === ownerAccountId) {
            return { success: false, error: "You cannot grant access to yourself." };
        }
        
        const targetAccountType = await getAccountType(targetAccountId);
        if (targetAccountType !== 'individual' && targetAccountType !== 'dependent') {
            return { success: false, error: "You can only grant access to individual accounts." };
        }


        // Check if already added
        const alreadyExists = await prisma.authzAccountAccessGrant.findFirst({
          where: {
            ownerAccountId: ownerAccountId,
            targetAccountId: targetAccountId,
            appId: 'neup.account',
          }
        });

        if (alreadyExists) {
            return { success: false, error: "This user already has access." };
        }
        
        const existingRequest = await prisma.request.findFirst({
          where: {
            action: 'access_invitation',
            senderId: ownerAccountId,
            recipientId: targetAccountId,
            status: 'pending'
          }
        });

        if(existingRequest) {
            return { success: false, error: 'An invitation has already been sent to this user.' };
        }


        // Add the new access document with a 'pending' status
        const request = await prisma.request.create({
          data: {
            action: 'access_invitation',
            senderId: ownerAccountId,
            recipientId: targetAccountId,
            status: 'pending'
          }
        });
        
        await prisma.notification.create({
          data: {
            accountId: targetAccountId,
            action: 'access_invitation',
            title: 'New Access Invitation',
            message: `You have received an access invitation from ${ownerAccountId}`,
            type: 'info',
            read: false,
            detail: { requestId: request.id }
          }
        });


        await logActivity(ownerAccountId, `Sent access invitation to ${neupId}`, 'Pending', undefined, undefined, geolocation);
        revalidatePath('/manage/access');
        return { success: true };

    } catch (error) {
        await logError('database', error, 'grantAccessByNeupId');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}