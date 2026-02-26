

'use server';

import prisma from '@/lib/prisma';
import { getUserNeupIds, getUserProfile as fetchUserProfile, checkPermissions } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/log-actions';

import type {
  UserDetails,
  UserActivityLog,
  UserPermissions,
  UserDashboardStats,
} from '@/types';

// Simplified for now, can be expanded later.
export type UserDetailsLimited = {
  accountId: string;
  neupId: string;
  nameDisplay: string;
};

export async function getUserDetails(
  accountId: string
): Promise<UserDetails | null> {
  const profile = await fetchUserProfile(accountId);

  if (!profile) {
    return null;
  }

  return {
    accountId,
    neupId: profile.neupIdPrimary || 'N/A',
    profile,
    accountType: profile.accountType || 'individual',
  };
}

export async function getAccountDetails(accountId: string) {
    const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: {
            block: true,
        },
    });
    if (!account) return null;
    return account;
}


export async function getActivity(accountId: string): Promise<UserActivityLog[]> {
    const rows = await prisma.activityLog.findMany({
        where: { targetAccountId: accountId },
        orderBy: { timestamp: 'desc' },
        take: 20,
    });
    return rows.map(row => {
        const rawTimestamp = new Date(row.timestamp);
        return {
            id: row.id,
            action: row.action,
            status: row.status,
            ip: row.ip,
            timestamp: rawTimestamp.toLocaleString(),
            geolocation: row.geolocation || undefined,
            rawTimestamp,
        };
    });
}

import { PERMISSION_SET } from '@/lib/permissions';

export async function getPermissions(accountId: string): Promise<UserPermissions> {
    const permit = await prisma.permit.findFirst({
        where: { accountId, forSelf: true },
        select: { permissions: true, restrictions: true },
    });
    if (!permit) {
        return { assignedPermissions: [], restrictedPermissions: [], allPermissions: [] };
    }
    const permissionIds = permit.permissions || [];
    const restrictionIds = permit.restrictions || [];
    
    // In the new system, permissionIds are keys in PERMISSION_SET or individual permission strings.
    // We collect all permissions from assigned sets, then remove restricted ones.
    const allPermissions = new Set<string>();
    
    permissionIds.forEach(id => {
        const set = PERMISSION_SET[id];
        if (set) {
            set.forEach(p => allPermissions.add(p));
        } else {
            // It might be an individual permission
            allPermissions.add(id);
        }
    });

    restrictionIds.forEach(id => {
        const set = PERMISSION_SET[id];
        if (set) {
            set.forEach(p => allPermissions.delete(p));
        } else {
            allPermissions.delete(id);
        }
    });

    return {
        assignedPermissions: permissionIds,
        restrictedPermissions: restrictionIds,
        allPermissions: Array.from(allPermissions),
    };
}

export async function updateUserPermissions(accountId: string, newPermissionIds: string[], newRestrictionIds: string[]): Promise<{success: boolean, error?: string}> {
    const canUpdate = await checkPermissions(['root.permission.edit']);
    if (!canUpdate) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        const existing = await prisma.permit.findFirst({
            where: { accountId, forSelf: true },
            select: { id: true },
        });
        if (!existing) {
            await prisma.permit.create({
                data: {
                    accountId,
                    forSelf: true,
                    isRoot: false,
                    permissions: newPermissionIds,
                    restrictions: newRestrictionIds,
                },
            });
        } else {
            await prisma.permit.update({
                where: { id: existing.id },
                data: {
                    permissions: newPermissionIds,
                    restrictions: newRestrictionIds,
                },
            });
        }
        
        const adminId = await getPersonalAccountId() ?? "";
        await logActivity(accountId, `Permissions updated by root user ${adminId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/accounts/${accountId}/permissions`);

        return { success: true };

    } catch (e) {
        console.error("Error updating permissions:", e);
        return { success: false, error: "An unexpected error occurred." };
    }
}


export async function getUserDashboardStats(accountId: string): Promise<UserDashboardStats> {
    const last = await prisma.activityLog.findFirst({
        where: { targetAccountId: accountId },
        orderBy: { timestamp: 'desc' },
    });
    if (!last) {
        return {
            lastIpAddress: 'N/A',
            lastLocation: 'N/A',
            lastActive: 'N/A',
        };
    }
    return {
        lastIpAddress: last.ip,
        lastLocation: last.geolocation || 'N/A',
        lastActive: new Date(last.timestamp).toLocaleString(),
    }
}
