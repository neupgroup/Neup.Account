

'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, doc, setDoc } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import crypto from 'crypto';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { checkPermissions } from '@/lib/user-actions';

export type Application = {
    id: string;
    name: string;
    description: string;
};

const addAppSchema = z.object({
    id: z.string().min(3, { message: "App ID must be at least 3 characters." }),
    name: z.string().min(3, { message: "App name must be at least 3 characters." }),
    description: z.string().min(10, { message: "Description must be at least 10 characters." }),
});

export async function getApps(searchQuery?: string): Promise<Application[]> {
    const canView = await checkPermissions(['root.app.view']);
    if (!canView) return [];

    try {
        const appsCollection = collection(db, 'applications');
        const q = query(appsCollection);
        const appsSnapshot = await getDocs(q);

        let allApps = appsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Application));

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            allApps = allApps.filter(app =>
                app.name.toLowerCase().includes(lowercasedQuery) ||
                app.id.toLowerCase().includes(lowercasedQuery) ||
                app.description.toLowerCase().includes(lowercasedQuery)
            );
        }
        
        return allApps;

    } catch (error) {
        await logError('database', error, 'getApps');
        return [];
    }
}


export async function addApp(formData: FormData) {
    const canCreate = await checkPermissions(['root.app.create']);
    if (!canCreate) {
        return { success: false, error: 'Permission denied.' };
    }

    const rawData = {
        id: formData.get('id'),
        name: formData.get('name'),
        description: formData.get('description'),
    };

    const validation = addAppSchema.safeParse(rawData);

    if (!validation.success) {
        return {
            success: false,
            error: "Validation failed.",
            details: validation.error.flatten().fieldErrors,
        };
    }

    const { id, name, description } = validation.data;

    try {
        // We use setDoc here with a specific ID provided by the user
        await setDoc(doc(db, 'applications', id), {
            name,
            description,
        });
        
        const adminId = await getPersonalAccountId();
        await logActivity(adminId || 'unknown', `Created Application: ${name} (${id})`, 'Success');

        revalidatePath('/manage/root/app');
        return { success: true, message: 'Application added successfully.' };
    } catch (error) {
        await logError('database', error, 'addApp');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
