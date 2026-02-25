'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { logActivity } from '@/lib/log-actions';
import { checkPermissions } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import type { Permission } from '@/types';

// --- Types ---
type GetPermissionsResponse = {
  permissions: Permission[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

// --- Schemas ---
const addPermissionSchema = z.object({
  name: z.string().min(3, { message: 'Set name must be at least 3 characters.' }),
  app_id: z.string().min(3, { message: 'App Slug must be at least 3 characters.' }),
  access: z.array(z.string()).min(1, { message: 'At least one permission is required.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  intended_for: z.enum(['individual', 'brand', 'dependent', 'branch', 'root']),
});

const editPermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    access: z.array(z.string()).min(1, { message: "At least one permission is required." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

// --- Actions ---

export async function getMasterPermissions(
  searchQuery: string,
  page: number,
  pageSize: number
): Promise<GetPermissionsResponse> {
  try {
    const canView = await checkPermissions(['root.permission.view']);
    if (!canView) {
      return { permissions: [], hasNextPage: false, hasPrevPage: false };
    }

    // Get all permissions from Prisma and transform them to permission sets
    const allPermissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' }
    });

    // Group permissions by app_id to create permission sets
    const permissionSets = allPermissions.reduce((acc, perm) => {
      const key = perm.appId || 'default';
      if (!acc[key]) {
        acc[key] = {
          id: perm.id,
          name: perm.name,
          app_id: key,
          access: [],
          description: `Permissions for ${key}`,
          intended_for: 'root' as const
        };
      }
      acc[key].access.push(...perm.access);
      return acc;
    }, {} as Record<string, Permission>);

    let permissions = Object.values(permissionSets);

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      permissions = permissions.filter(
        (p) =>
          p.name.toLowerCase().includes(lowercasedQuery) ||
          p.description.toLowerCase().includes(lowercasedQuery) ||
          p.app_id.toLowerCase().includes(lowercasedQuery) ||
          p.access.some((a) => a.toLowerCase().includes(lowercasedQuery))
      );
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;

    const paginatedPermissions = permissions.slice(startIndex, endIndex);

    return {
      permissions: paginatedPermissions,
      hasNextPage: endIndex < permissions.length,
      hasPrevPage: startIndex > 0,
    };
  } catch (error) {
    await logError('database', error, 'getMasterPermissions');
    return { permissions: [], hasNextPage: false, hasPrevPage: false };
  }
}

export async function addPermission(
  formData: FormData
): Promise<{
  success: boolean;
  error?: string;
  details?: any;
  newPermission?: Permission;
}> {
  const canCreate = await checkPermissions(['root.permission.create']);
  if (!canCreate) {
    return { success: false, error: 'Permission denied.' };
  }

  const rawData = {
    name: formData.get('name'),
    app_id: formData.get('app_id'),
    access: formData.getAll('access'), // Get all permissions as an array
    description: formData.get('description'),
    intended_for: formData.get('intended_for'),
  };

  const validation = addPermissionSchema.safeParse(rawData);

  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed.',
      details: validation.error.flatten().fieldErrors,
    };
  }

  const { name, app_id, access: accessArray, description, intended_for } = validation.data;

  if (accessArray.length === 0) {
    return { success: false, error: 'Access permissions cannot be empty.' };
  }

  try {
    // Check if permission set with this name already exists
    const existing = await prisma.permission.findUnique({
      where: { name }
    });
    
    if (existing) {
      return { success: false, error: 'This permission set name already exists.' };
    }

    const newPermission = await prisma.permission.create({
      data: {
        name,
        appId: app_id,
        access: accessArray,
        type: 'addition' // Default type for permission sets
      }
    });

    const adminId = await getPersonalAccountId();
    await logActivity(adminId || 'unknown', `Created Permission Set: ${name}`, 'Success');

    revalidatePath('/manage/root/permission');

    const newPermissionSet: Permission = {
      id: newPermission.id,
      name: newPermission.name,
      app_id: newPermission.appId || '',
      access: newPermission.access,
      description,
      intended_for: intended_for as any,
    };

    return {
      success: true,
      error: undefined,
      details: undefined,
      newPermission: newPermissionSet,
    };
  } catch (error) {
    await logError('database', error, 'addPermission');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function checkAppIdExists(appId: string): Promise<{ exists: boolean }> {
  return { exists: false };
}

export async function checkPermissionNameExists(
  name: string,
  currentId?: string
): Promise<{ exists: boolean }> {
  if (!name) return { exists: false };
  try {
    const existing = await prisma.permission.findUnique({
      where: { name }
    });

    if (!existing) {
      return { exists: false };
    }

    if (currentId && existing.id === currentId) {
      return { exists: false };
    }

    return { exists: true };
  } catch (error) {
    await logError('database', error, 'checkPermissionNameExists');
    return { exists: true }; // Fail safe
  }
}

export async function getPermissionSetDetails(id: string): Promise<Permission | null> {
    const canView = await checkPermissions(['root.permission.view']);
    if (!canView) return null;

    try {
        const permission = await prisma.permission.findUnique({
            where: { id }
        });

        if (permission) {
            return {
                id: permission.id,
                name: permission.name,
                app_id: permission.appId || '',
                access: permission.access,
                description: `Permissions for ${permission.appId || 'default'}`,
                intended_for: 'root' as const,
            };
        }
        return null;
    } catch (error) {
        await logError('database', error, `getPermissionSetDetails for id: ${id}`);
        return null;
    }
}

export async function updatePermissionSet(id: string, formData: FormData): Promise<{ success: boolean; error?: string; details?: any; }> {
    const canEdit = await checkPermissions(['root.permission.edit']);
    if (!canEdit) {
        return { success: false, error: 'Permission denied.' };
    }

    const rawData = {
        name: formData.get('name'),
        access: formData.getAll('access'),
        description: formData.get('description'),
    };
    const validation = editPermissionSchema.safeParse(rawData);

    if (!validation.success) {
        return { success: false, error: "Validation failed.", details: validation.error.flatten().fieldErrors };
    }
    
    const { access: accessArray, ...rest } = validation.data;

    try {
        await prisma.permission.update({
            where: { id },
            data: { 
                ...rest, 
                access: accessArray 
            }
        });
        
        const adminId = await getPersonalAccountId();
        await logActivity(adminId || 'unknown', `Updated Permission Set: ${rest.name}`, 'Success');
        
        revalidatePath('/manage/root/permission');
        revalidatePath(`/manage/root/permission/${id}`);

        return { success: true };
    } catch (error) {
        await logError('database', error, `updatePermission for id: ${id}`);
        return { success: false, error: "Failed to update permission set." };
    }
}

export async function deletePermissionSet(id: string): Promise<{ success: boolean; error?: string; }> {
    const canDelete = await checkPermissions(['root.permission.delete']);
    if (!canDelete) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        const permission = await prisma.permission.findUnique({
            where: { id }
        });
        const name = permission?.name || id;

        await prisma.permission.delete({
            where: { id }
        });

        const adminId = await getPersonalAccountId();
        await logActivity(adminId || 'unknown', `Deleted Permission Set: ${name}`, 'Success');

        revalidatePath('/manage/root/permission');
        return { success: true };
    } catch (error) {
        await logError('database', error, `deletePermissionSet for id: ${id}`);
        return { success: false, error: "Failed to delete permission set." };
    }
}
