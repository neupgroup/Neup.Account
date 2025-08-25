'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getUserProfile, getUserNeupIds, checkPermissions } from '@/lib/user-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';

export type PendingNeupIdRequest = {
    id: string;
    userFullName: string;
    requestedNeupId: string;
    requestDate: string;
    status: string;
    currentNeupIds: string[];
    accountId: string;
};

// Internal type to include raw date for sorting
type PendingRequestInternal = PendingNeupIdRequest & {
    createdAt: Date;
};


export async function getPendingNeupIdRequests(): Promise<PendingNeupIdRequest[]> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return [];

    try {
        const requestsRef = collection(db, 'requests');
        const q = query(requestsRef, where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const requests = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                const accountId = data.accountId;

                if (!accountId) {
                    return null;
                }

                const [profile, currentNeupIds] = await Promise.all([
                    getUserProfile(accountId),
                    getUserNeupIds(accountId)
                ]);

                const userFullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown User';
                
                const createdAt = data.createdAt?.toDate() || new Date();

                return {
                    id: doc.id,
                    userFullName,
                    requestedNeupId: data.requestedNeupId,
                    requestDate: createdAt.toLocaleDateString(),
                    status: data.status,
                    currentNeupIds: currentNeupIds,
                    accountId: accountId,
                    createdAt: createdAt
                };
            })
        );
        const validRequests = requests.filter((request): request is PendingRequestInternal => request !== null);
        validRequests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        return validRequests.map(({ createdAt, ...rest }) => rest);

    } catch (error) {
        await logError('database', error, 'getPendingNeupIdRequests');
        return [];
    }
}

export async function getNeupIdRequestDetails(id: string): Promise<PendingNeupIdRequest | null> {
    const canView = await checkPermissions(['root.requests.view']);
    if (!canView) return null;

    try {
        const requestRef = doc(db, 'requests', id);
        const requestDoc = await getDoc(requestRef);

        if (!requestDoc.exists()) {
            return null;
        }

        const data = requestDoc.data();
        const accountId = data.accountId;

        if (!accountId) {
            return null;
        }

        const [profile, currentNeupIds] = await Promise.all([
            getUserProfile(accountId),
            getUserNeupIds(accountId)
        ]);

        const userFullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown User';
        const createdAt = data.createdAt?.toDate() || new Date();

        return {
            id: requestDoc.id,
            userFullName,
            requestedNeupId: data.requestedNeupId,
            requestDate: createdAt.toLocaleDateString(),
            status: data.status,
            currentNeupIds: currentNeupIds,
            accountId: accountId,
        };
    } catch (error) {
        await logError('database', error, `getNeupIdRequestDetails: ${id}`);
        return null;
    }
}

export async function approveNeupIdRequest(requestId: string, accountId: string, newNeupId: string): Promise<{success: boolean, error?: string}> {
    const canApprove = await checkPermissions(['root.requests.approve']);
    if (!canApprove) {
        return { success: false, error: 'Permission denied.' };
    }

    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, { status: 'approved' });

        const neupidDocRef = doc(db, 'neupid', newNeupId.toLowerCase());
        await setDoc(neupidDocRef, {
            for: accountId,
            is_primary: false,
        });

        await logActivity(accountId, `Approved NeupID Request: ${newNeupId}`, 'Success');

        return { success: true };
    } catch (error) {
        await logError('database', error, `approveNeupIdRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function denyNeupIdRequest(requestId: string): Promise<{success: boolean, error?: string}> {
    const canDeny = await checkPermissions(['root.requests.deny']);
    if (!canDeny) {
        return { success: false, error: 'Permission denied.' };
    }
    
    try {
        const requestRef = doc(db, 'requests', requestId);
        const requestDoc = await getDoc(requestRef);
        const accountId = requestDoc.data()?.accountId;

        await updateDoc(requestRef, { status: 'denied' });
        
        if (accountId) {
            await logActivity(accountId, `Denied NeupID Request: ${requestDoc.data()?.requestedNeupId}`, 'Success');
        }

        return { success: true };
    } catch (error) {
        await logError('database', error, `denyNeupIdRequest: ${requestId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
