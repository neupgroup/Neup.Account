'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
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

    const permissionsCollection = collection(db, 'permission');
    const q = query(permissionsCollection, orderBy('name'));
    const permissionsSnapshot = await getDocs(q);

    let allPermissions = permissionsSnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Permission)
    );

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      allPermissions = allPermissions.filter(
        (p) =>
          p.name.toLowerCase().includes(lowercasedQuery) ||
          p.description.toLowerCase().includes(lowercasedQuery) ||
          p.app_id.toLowerCase().includes(lowercasedQuery) ||
          p.access.some((a) => a.toLowerCase().includes(lowercasedQuery))
      );
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = page * pageSize;

    const paginatedPermissions = allPermissions.slice(startIndex, endIndex);

    return {
      permissions: paginatedPermissions,
      hasNextPage: endIndex < allPermissions.length,
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
    const q = query(collection(db, 'permission'), where('name', '==', name));
    const existing = await getDocs(q);
    if (!existing.empty) {
      return { success: false, error: 'This permission set name already exists.' };
    }

    const newDocRef = await addDoc(collection(db, 'permission'), {
      name,
      app_id,
      access: accessArray,
      description,
      intended_for,
    });

    const adminId = await getPersonalAccountId();
    await logActivity(adminId || 'unknown', `Created Permission Set: ${name}`, 'Success');

    revalidatePath('/manage/root/permission');

    const newPermission: Permission = {
      id: newDocRef.id,
      name,
      app_id,
      access: accessArray,
      description,
      intended_for,
    };

    return {
      success: true,
      error: undefined,
      details: undefined,
      newPermission,
    };
  } catch (error) {
    await logError('database', error, 'addPermission');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function checkAppIdExists(appId: string): Promise<{ exists: boolean }> {
  if (!appId) return { exists: false };
  try {
    const appRef = doc(db, 'applications', appId);
    const appDoc = await getDoc(appRef);
    return { exists: appDoc.exists() };
  } catch (error) {
    await logError('database', error, `checkAppIdExists: ${appId}`);
    return { exists: false }; // Fail safe
  }
}

export async function checkPermissionNameExists(
  name: string,
  currentId?: string
): Promise<{ exists: boolean }> {
  if (!name) return { exists: false };
  try {
    const q = query(collection(db, 'permission'), where('name', '==', name));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { exists: false };
    }

    if (currentId && querySnapshot.docs[0].id === currentId) {
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
        const docRef = doc(db, 'permission', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Permission;
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
        const docRef = doc(db, 'permission', id);
        await updateDoc(docRef, { ...rest, access: accessArray });
        
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
        const docRef = doc(db, 'permission', id);
        const docData = await getDoc(docRef);
        const name = docData.data()?.name || id;

        await deleteDoc(docRef);

        const adminId = await getPersonalAccountId();
        await logActivity(adminId || 'unknown', `Deleted Permission Set: ${name}`, 'Success');

        revalidatePath('/manage/root/permission');
        return { success: true };
    } catch (error) {
        await logError('database', error, `deletePermissionSet for id: ${id}`);
        return { success: false, error: "Failed to delete permission set." };
    }
}