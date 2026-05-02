'use server';

import prisma from '@/core/helpers/prisma';
import { getActiveAccountId, getPersonalAccountId } from '@/core/auth/verify';
import { getUserProfile, getUserNeupIds, getAccountType, getUserPermissions, checkPermissions } from '@/core/helpers/user';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logActivity } from '@/core/helpers/log-actions';
import type { Permission } from '@/core/helpers/permissions';
import { PERMISSION_SET } from '@/core/helpers/permissions';

export type UserAccess = {
  permitId: string;
  userId: string;
  displayName: string;
  accountPhoto?: string;
  permissions: string[];
  status: 'pending' | 'approved' | 'rejected';
};

export type AccessDetails = {
  permitId: string;
  grantedTo: {
    id: string;
    name: string;
    neupId: string;
  };
  grantedBy: {
    id: string;
    name: string;
  };
  grantedOn: string;
  permissions: string[];
};

/**
 * Function getMasterPermissions.
 */
export async function getMasterPermissions(): Promise<Permission[]> {
    // Collect all unique permission set keys (roles) and unique permissions from roles
    const allSetKeys = Object.keys(PERMISSION_SET);
    const allIndividualPermissions = new Set(Object.values(PERMISSION_SET).flat());

    // Combine roles and individual permissions
    const combined = new Set([...allSetKeys, ...allIndividualPermissions]);

    return Array.from(combined).sort().map(p => ({
        id: p,
        name: p
    }));
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
 */
export async function getAccessList(accountId: string): Promise<UserAccess[]> {
  try {
    const permits = await prisma.permit.findMany({
      where: {
        targetAccountId: accountId,
        forSelf: false,
        isRoot: false
      }
    });

    const accessList = await Promise.all(
      permits.map(async (permit: any) => {
        const userProfile = await getUserProfile(permit.accountId);
        if (!userProfile) return null;

        return {
          permitId: permit.id,
          userId: permit.accountId,
          displayName:
            userProfile.nameDisplay ||
            `${userProfile.nameFirst} ${userProfile.nameLast}`.trim(),
          accountPhoto: userProfile.accountPhoto,
          permissions: permit.permissions || [],
          status: 'approved' as const,
        };
      })
    );

    const validUsers = accessList.filter((user): user is NonNullable<typeof user> => user !== null);

    return validUsers;

  } catch (error) {
    await logError('database', error, `getAccessList for ${accountId}`);
    return [];
  }
}


/**
 * Function getAccessDetails.
 */
export async function getAccessDetails(permitId: string): Promise<AccessDetails | null> {
    try {
        const permit = await prisma.permit.findUnique({
          where: { id: permitId }
        });

        if (!permit) {
            return null;
        }
        
        const [grantedToProfile, grantedByProfile, grantedToNeupIds] = await Promise.all([
            getUserProfile(permit.accountId), // The user who has access
            getUserProfile(permit.targetAccountId!),   // The account being accessed
            getUserNeupIds(permit.accountId)
        ]);

        if (!grantedToProfile || !grantedByProfile) {
            return null;
        }

        return {
            permitId: permit.id,
            grantedTo: {
                id: permit.accountId,
                name: grantedToProfile.nameDisplay || `${grantedToProfile.nameFirst} ${grantedToProfile.nameLast}`.trim(),
                neupId: grantedToNeupIds[0] || 'N/A'
            },
            grantedBy: {
                id: permit.targetAccountId!,
                name: grantedByProfile.nameDisplay || `${grantedByProfile.nameFirst} ${grantedByProfile.nameLast}`.trim()
            },
            grantedOn: permit.createdOn.toLocaleString(),
            permissions: permit.permissions || []
        }

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
        const permit = await prisma.permit.findUnique({
          where: { id: permitId }
        });

        if (!permit || permit.targetAccountId !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }
        
        const removedUserId = permit.accountId;
        await prisma.permit.delete({
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
    const userPermissions = await getUserPermissions(managedAccountId);
    
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

    try {
        const permit = await prisma.permit.findUnique({
          where: { id: permitId }
        });

        if (!permit || permit.targetAccountId !== currentAccountId) {
            return { success: false, error: "Permission denied or grant not found." };
        }

        // --- Permission Delegation Check ---
        const userResolvedPermissions = await getUserPermissions(currentAccountId);
        const userResolvedPermSet = new Set(userResolvedPermissions);
        
        // Ensure that for every role/permission we are granting, the user has all those permissions
        const isAllowed = newPermissionIds.every(entry => {
            const toApply = PERMISSION_SET[entry] || [entry];
            return toApply.every(p => userResolvedPermSet.has(p));
        });

        if (!isAllowed) {
            return { success: false, error: "You are trying to grant permissions you do not possess." };
        }
        // --- End Check ---
        
        const targetUserId = permit.accountId;
        await prisma.permit.update({
          where: { id: permitId },
          data: { permissions: newPermissionIds }
        });
        
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
        const alreadyExists = await prisma.permit.findFirst({
          where: {
            targetAccountId: ownerAccountId,
            accountId: targetAccountId
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
            requestId: request.id,
            read: false,
            createdAt: new Date()
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