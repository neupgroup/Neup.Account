 'use server';
 
 import prisma from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import crypto from 'crypto';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { checkPermissions } from '@/lib/user';
import type { Application } from '@/types';
 
 const addAppSchema = z.object({
     id: z.string().min(3, { message: 'App ID must be at least 3 characters.' }),
     name: z.string().min(3, { message: 'App name must be at least 3 characters.' }),
     description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
 });
 
 export async function getApps(searchQuery?: string): Promise<Application[]> {
    const canView = await checkPermissions(['root.app.view']);
    if (!canView) return [];

    try {
        const apps = await prisma.application.findMany({
            where: searchQuery ? {
                OR: [
                    { name: { contains: searchQuery, mode: 'insensitive' } },
                    { id: { contains: searchQuery, mode: 'insensitive' } },
                    { description: { contains: searchQuery, mode: 'insensitive' } },
                ],
            } : {},
            orderBy: { createdAt: 'desc' }
        });

        return apps.map(app => {
            const { appSecret, ...data } = app;
            return { ...data } as unknown as Application;
        });
    } catch (error) {
        await logError('database', error, 'getApps');
        return [];
    }
}

export async function getAppDetails(appId: string): Promise<Application | null> {
    const canView = await checkPermissions(['root.app.view']);
    if (!canView) return null;

    try {
        const app = await prisma.application.findUnique({
            where: { id: appId }
        });

        if (app) {
            const { appSecret, ...data } = app;
            return { ...data } as unknown as Application;
        }

        return null;
    } catch (error) {
        await logError('database', error, `getApplicationDetails: ${appId}`);
        return null;
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
            error: 'Validation failed.',
            details: validation.error.flatten().fieldErrors,
        };
    }

    const { id, name, description } = validation.data;

    try {
        await prisma.application.create({
            data: {
                id,
                name,
                description,
                appSecret: null,
            }
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

export async function regenerateAppSecret(appId: string): Promise<{ success: boolean; newSecret?: string; error?: string }> {
    const canEdit = await checkPermissions(['root.app.edit']);
    if (!canEdit) {
        return { success: false, error: 'Permission denied.' };
    }

    const newSecret = crypto.randomBytes(32).toString('hex');

    try {
        await prisma.application.update({
            where: { id: appId },
            data: { appSecret: newSecret }
        });

        const adminId = await getPersonalAccountId();
        await logActivity(adminId || 'unknown', `Regenerated App Secret for: ${appId}`, 'Success');

        return { success: true, newSecret };
    } catch (error) {
        await logError('database', error, `regenerateAppSecret: ${appId}`);
        return { success: false, error: 'Failed to regenerate app secret.' };
    }
}
 
