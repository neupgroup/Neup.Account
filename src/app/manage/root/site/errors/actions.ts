

'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, getDoc, doc, startAfter, endBefore, limit } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { getUserProfile } from '@/lib/user-actions';

const PAGE_SIZE = 10;

export type SystemError = {
    id: string;
    type: 'ai' | 'database' | 'validation' | 'auth' | 'unknown';
    context: string;
    message: string;
    timestamp: string;
    status: 'new' | 'in_progress' | 'solved';
};

export type SystemErrorDetails = SystemError & {
    fullError: string;
    user?: {
        name: string;
        neupId: string;
    };
    ipAddress?: string;
    geolocation?: string;
    reproSteps?: string;
    solution?: string;
    solvedBy?: string;
    problemLevel?: 'hot' | 'warm' | 'cold';
};

type ErrorInternal = SystemError & { rawTimestamp: Date };

export async function getSystemErrors({
  startAfter: startAfterDocId,
}: {
  startAfter?: string;
}): Promise<{
  errors: SystemError[];
  hasNextPage: boolean;
}> {
    try {
        const errorsCollection = collection(db, 'error');
        let constraints = [];
        constraints.push(orderBy('timestamp', 'desc'));

        if (startAfterDocId) {
            const startDoc = await getDoc(doc(db, 'error', startAfterDocId));
            constraints.push(startAfter(startDoc));
        }

        constraints.push(limit(PAGE_SIZE + 1));

        const q = query(errorsCollection, ...constraints);
        const errorsSnapshot = await getDocs(q);
        const pageDocs = errorsSnapshot.docs;

        const hasNextPage = pageDocs.length > PAGE_SIZE;
        if (hasNextPage) {
            pageDocs.pop();
        }

        const errors: SystemError[] = pageDocs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate() || new Date();
            return {
                id: doc.id,
                type: data.type,
                context: data.context,
                message: data.message.split('\n')[0], // Show first line only
                timestamp: timestamp.toLocaleString(),
                status: data.status || 'new'
            };
        });

        return {
            errors,
            hasNextPage,
        };

    } catch (error) {
        // Avoid an infinite loop if logging itself fails.
        console.error("CRITICAL: Could not fetch system errors.", error);
        return { errors: [], hasNextPage: false };
    }
}

// Function to get detailed error info.
export async function getErrorDetails(id: string): Promise<SystemErrorDetails | null> {
    try {
        const errorRef = doc(db, 'error', id);
        const errorDoc = await getDoc(errorRef);

        if (!errorDoc.exists()) {
            return null;
        }

        const data = errorDoc.data();
        let user;
        if (data.accountId) {
             const userProfile = await getUserProfile(data.accountId);
             user = {
                 name: userProfile?.displayName || 'Unknown User',
                 neupId: userProfile?.neupId || 'N/A'
             }
        }

        return {
            id: errorDoc.id,
            type: data.type,
            context: data.context,
            message: data.message.split('\n')[0],
            fullError: data.message,
            timestamp: data.timestamp?.toDate().toLocaleString() || 'N/A',
            status: data.status || 'new',
            user,
            ipAddress: data.ipAddress,
            geolocation: data.geolocation,
            reproSteps: data.reproSteps,
            solution: data.solution,
            solvedBy: data.solvedBy,
            problemLevel: data.problemLevel
        }

    } catch(e) {
        await logError('database', e, `getErrorDetails for id ${id}`);
        return null;
    }
}
