'use server';

import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';
import type { Application } from '@/types';

export async function getApps(searchQuery?: string): Promise<Application[]> {
    // Note: Management UI has been removed, but this helper may still be used internally.
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
