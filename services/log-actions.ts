'use server';

// Handles writing and reading activity logs from the database.
// Activity logs record user actions (e.g. login, profile update) with status and IP.

import prisma from '@/core/helpers/prisma';
import { headers } from 'next/headers';
import { getUserProfile } from '@/services/user';
import { logError } from '@/core/helpers/logger';
import { getActiveAccountId } from '@/core/auth/verify';

// Number of activity logs returned per page
const PAGE_SIZE = 10;

export type ActivityLog = {
    id: string;
    user: string;
    neupId: string;
    action: string;
    status: string;
    timestamp: string;
};

// Writes a single activity entry to the database.
// If actorAccountId is not provided, the target account is assumed to be the actor.
// IP is read from the request headers if not explicitly passed.
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

        await prisma.activity.create({
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

// Fetches a paginated list of activity logs, ordered by most recent first.
// If forCurrentUser is true, only logs where the actor is the current account are returned.
// Uses cursor-based pagination via startAfter (the ID of the last seen log).
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
            // Fetch one extra to determine if there is a next page
            take: PAGE_SIZE + 1,
        };

        if (startAfterDocId) {
            queryOptions.cursor = { id: startAfterDocId };
            queryOptions.skip = 1;
        }

        const pageDocs = await prisma.activity.findMany(queryOptions);

        let hasNextPage = pageDocs.length > PAGE_SIZE;
        if (hasNextPage) {
            pageDocs.pop(); // remove the extra record used for next-page detection
        }

        const logs: ActivityLog[] = await Promise.all(pageDocs.map(async (doc) => {
            const [actorProfile, neupIds] = await Promise.all([
                getUserProfile(doc.actorAccountId),
                prisma.neupId.findMany({
                    where: { accountId: doc.actorAccountId },
                    take: 1
                })
            ]);
            
            // Resolve the best available display name for the actor
            const getDisplayName = (profile: any, fallbackId: string) => {
                if (!profile) return fallbackId;
                return profile.nameDisplay || profile.displayName || `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim() || fallbackId;
            };

            return {
                id: doc.id,
                user: getDisplayName(actorProfile, doc.actorAccountId),
                neupId: neupIds[0]?.id || 'N/A',
                action: doc.action,
                status: doc.status,
                timestamp: doc.timestamp.toLocaleString(),
            };
        }));
        
        return { logs, hasNextPage };

    } catch (error) {
        await logError('database', error, 'getActivities');
        return { logs: [], hasNextPage: false };
    }
}
