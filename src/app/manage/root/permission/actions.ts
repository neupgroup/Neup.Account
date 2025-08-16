

'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import crypto from 'crypto';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { checkPermissions } from '@/lib/user-actions';

// --- Types ---
export type Permission = {
    id: string;
    name: string; // e.g. property_ReadWrite
    app_id: string; // e.g. neup_console
    access: string[]; // e.g. ["property.read", "property.write"]
    description: string;
};

type GetPermissionsResponse = {
  permissions: Permission[];
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// --- Schemas ---
const addPermissionSchema = z.object({
    name: z.string().min(3, { message: "Set name must be at least 3 characters." }),
    app_id: z.string().min(3, { message: "App Slug must be at least 3 characters." }),
    access: z.array(z.string()).min(1, { message: "At least one permission is required." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

// --- Actions ---

export async function getMasterPermissions(searchQuery: string, page: number, pageSize: number): Promise<GetPermissionsResponse> {
    const canView = await checkPermissions(['root.permission.view']);
    if (!canView) {
        return { permissions: [], hasNextPage: false, hasPrevPage: false };
    }

    try {
        const permissionsCollection = collection(db, 'permission');
        const q = query(permissionsCollection, orderBy('name'));
        const permissionsSnapshot = await getDocs(q);
        
        let allPermissions = permissionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Permission));

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            allPermissions = allPermissions.filter(p => 
                p.name.toLowerCase().includes(lowercasedQuery) ||
                p.description.toLowerCase().includes(lowercasedQuery) ||
                p.app_id.toLowerCase().includes(lowercasedQuery) ||
                p.access.some(a => a.toLowerCase().includes(lowercasedQuery))
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

export async function addPermission(formData: FormData): Promise<{ success: boolean; error?: string; details?: any; newPermission?: Permission; }> {
    const canCreate = await checkPermissions(['root.permission.create']);
    if (!canCreate) {
        return { success: false, error: 'Permission denied.' };
    }

    const rawData = {
        name: formData.get('name'),
        app_id: formData.get('app_id'),
        access: formData.getAll('access'), // Get all permissions as an array
        description: formData.get('description'),
    };

    const validation = addPermissionSchema.safeParse(rawData);

    if (!validation.success) {
        return {
            success: false,
            error: "Validation failed.",
            details: validation.error.flatten().fieldErrors,
        };
    }

    const { name, app_id, access: accessArray, description } = validation.data;
    
    if(accessArray.length === 0) {
        return { success: false, error: "Access permissions cannot be empty." };
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
        };
        
        return { success: true, message: 'Permission set added successfully.', newPermission };
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

export async function checkPermissionNameExists(name: string, currentId?: string): Promise<{ exists: boolean }> {
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
    } catch(error) {
        await logError('database', error, 'checkPermissionNameExists');
        return { exists: true }; // Fail safe
    }
}
