'use server';

import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { getUserProfile } from './user';
import { logError } from './logger';
import { getActiveAccountId } from './auth-actions';

const PAGE_SIZE = 10;

export type ActivityLog = {
    id: string;
    user: string;
    neupId: string;
    action: string;
    status: string;
    timestamp: string;
};

export async function logActivity(
    targetAccountId: string,
    action: string,
    status: "Success" | "Failed" | "Pending" | "Alert",
    ipAddress?: string,
    actorAccountId?: string,
    geolocation?: string,
) {
    try {
        const ip = ipAddress || (await headers()).get('x-forwarded-for') || 'Unknown IP';
        
        const finalActorAccountId = actorAccountId || targetAccountId;

        await prisma.activityLog.create({
            data: {
                targetAccountId,
                actorAccountId: finalActorAccountId,
                action,
                status,
                ip,
                timestamp: new Date(),
                geolocation,
            }
        });

    } catch (error) {
        await logError('database', error, 'logActivity:create');
    }
}


type GetActivitiesParams = {
  startAfter?: string;
  forCurrentUser?: boolean;
};

type GetActivitiesResponse = {
  logs: ActivityLog[];
  hasNextPage: boolean;
};

export async function getActivities({ startAfter: startAfterDocId, forCurrentUser = false }: GetActivitiesParams): Promise<GetActivitiesResponse> {
    try {
        const currentAccountId = await getActiveAccountId();
        
        const where: any = {};
        if (forCurrentUser) {
            if (!currentAccountId) {
                 return { logs: [], hasNextPage: false };
            }
            where.actorAccountId = currentAccountId;
        }

        const queryOptions: any = {
            where,
            orderBy: { timestamp: 'desc' },
            take: PAGE_SIZE + 1,
        };

        if (startAfterDocId) {
            queryOptions.cursor = { id: startAfterDocId };
            queryOptions.skip = 1;
        }

        const pageDocs = await prisma.activityLog.findMany(queryOptions);

        let hasNextPage = pageDocs.length > PAGE_SIZE;
        if(hasNextPage) {
            pageDocs.pop(); // remove the extra one
        }

        let logs: ActivityLog[] = await Promise.all(pageDocs.map(async (doc) => {
            const timestamp = doc.timestamp;

            const [actorProfile, neupIds] = await Promise.all([
                getUserProfile(doc.actorAccountId),
                prisma.neupId.findMany({
                    where: { accountId: doc.actorAccountId },
                    take: 1
                })
            ]);
            
            const getDisplayName = (profile: any, fallbackId: string) => {
                if (!profile) return fallbackId;
                return profile.nameDisplay || profile.displayName || `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() || fallbackId;
            }

            return {
                id: doc.id,
                user: getDisplayName(actorProfile, doc.actorAccountId),
                neupId: neupIds[0]?.id || 'N/A',
                action: doc.action,
                status: doc.status,
                timestamp: timestamp.toLocaleString(),
            };
        }));
        
        return {
            logs: logs,
            hasNextPage,
        };

    } catch (error) {
        await logError('database', error, 'getActivities');
        return {
            logs: [],
            hasNextPage: false,
        };
    }
}