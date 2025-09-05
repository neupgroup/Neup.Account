

'use server';

import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, getDocs, orderBy, limit, getDoc, doc, startAfter, where } from 'firebase/firestore';
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

        const logData: { [key: string]: any } = {
            targetAccountId,
            actorAccountId: finalActorAccountId,
            action,
            status,
            ip,
            timestamp: serverTimestamp(),
        };
        
        if (geolocation) {
            logData.geolocation = geolocation;
        }

        await addDoc(collection(db, 'activity'), logData);

    } catch (error) {
        await logError('database', error, 'logActivity:addDoc');
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

type ActivityLogInternal = ActivityLog & { rawTimestamp: Date };


export async function getActivities({ startAfter: startAfterDocId, forCurrentUser = false }: GetActivitiesParams): Promise<GetActivitiesResponse> {
    try {
        const currentAccountId = await getActiveAccountId();
        
        const accountLogsCollection = collection(db, 'activity');
        
        let constraints = [];
        if (forCurrentUser) {
            if (!currentAccountId) {
                 return { logs: [], hasNextPage: false };
            }
            constraints.push(where('actorAccountId', '==', currentAccountId));
        }

        constraints.push(orderBy('timestamp', 'desc'));
        
        if (startAfterDocId) {
            const startAfterDoc = await getDoc(doc(db, 'activity', startAfterDocId));
            constraints.push(startAfter(startAfterDoc));
        }

        constraints.push(limit(PAGE_SIZE + 1)); // Fetch one extra to check for next page

        const q = query(accountLogsCollection, ...constraints);
        
        const querySnapshot = await getDocs(q);
        
        const pageDocs = querySnapshot.docs;

        let hasNextPage = pageDocs.length > PAGE_SIZE;
        if(hasNextPage) {
            pageDocs.pop(); // remove the extra one
        }

        let logs: ActivityLog[] = await Promise.all(pageDocs.map(async (doc) => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate() || new Date();

            const [actorProfile, neupIdsSnapshot] = await Promise.all([
                getUserProfile(data.actorAccountId),
                 getDocs(query(collection(db, 'neupId'), where('for', '==', data.actorAccountId), limit(1)))
            ]);
            
            const getDisplayName = (profile: any, fallbackId: string) => {
                if (!profile) return fallbackId;
                return profile.displayName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || fallbackId;
            }

            return {
                id: doc.id,
                user: getDisplayName(actorProfile, data.actorAccountId),
                neupId: neupIdsSnapshot.docs[0]?.id || 'N/A',
                action: data.action,
                status: data.status,
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
