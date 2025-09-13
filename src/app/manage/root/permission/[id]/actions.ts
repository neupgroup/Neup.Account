
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { checkPermissions } from '@/lib/user';
import type { Permission } from '@/actions/root/permission';

const editPermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    access: z.array(z.string()).min(1, { message: "At least one permission is required." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

export async function getPermissionDetails(id: string): Promise<Permission | null> {
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
        await logError('database', error, `getPermissionDetails for id: ${id}`);
        return null;
    }
}

export async function updatePermission(id: string, formData: FormData): Promise<{ success: boolean; error?: string; details?: any; }> {
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

export async function deletePermission(id: string): Promise<{ success: boolean; error?: string; }> {
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

    