'use server';

import prisma from '@/lib/prisma';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { checkPermissions } from '@/lib/user';
import { logError } from '@/lib/logger';
import type { Application } from '@/types';

type ConnectedApplications = {
    firstParty: Application[];
    thirdParty: Application[];
};

// Fetches applications the user is connected to.
export async function getConnectedApplications(): Promise<ConnectedApplications> {
    const canView = await checkPermissions(['security.third_party.view']);
    if (!canView) {
        return { firstParty: [], thirdParty: [] };
    }
    
    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { firstParty: [], thirdParty: [] };
    }

    try {
        const connections = await prisma.userAppConnection.findMany({
            where: { accountId },
            include: { application: true }
        });

        const allApps: Application[] = connections.map((conn: any) => ({
            id: conn.application.id,
            name: conn.application.name,
            party: conn.application.party as 'first' | 'third',
            description: conn.application.description || '',
            icon: conn.application.icon as any || undefined,
            website: conn.application.website || undefined,
            developer: conn.application.developer || undefined,
        }));

        const firstParty = allApps.filter(app => app.party === 'first');
        const thirdParty = allApps.filter(app => app.party === 'third');

        return { firstParty, thirdParty };

    } catch (error) {
        await logError('database', error, 'getConnectedApplications');
        return { firstParty: [], thirdParty: [] };
    }
}

// Fetches details for a single application by its ID.
export async function getApplicationDetails(appId: string): Promise<Application | null> {
    const canView = await checkPermissions(['security.third_party.view']);
    if (!canView) {
        return null;
    }
    
    try {
        const app = await prisma.application.findUnique({
            where: { id: appId }
        });

        if (app) {
            return {
                id: app.id,
                name: app.name,
                party: app.party as 'first' | 'third',
                description: app.description || '',
                icon: app.icon as any || undefined,
                website: (app as any).website || undefined,
                developer: app.developer || undefined,
            } as Application;
        }

        return null;
    } catch (error) {
        await logError('database', error, `getApplicationDetails: ${appId}`);
        return null;
    }
}
