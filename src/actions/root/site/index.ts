'use server';

import {db} from '@/lib/firebase';
import {collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, startAfter, limit, where} from 'firebase/firestore';
import {revalidatePath} from 'next/cache';
import {logError} from '@/lib/logger';
import {checkPermissions, getUserProfile} from '@/lib/user';
import type {SystemError, SystemErrorDetails, BugReport, BugReportDetails} from '@/types';


// --- ERRORS ---
const PAGE_SIZE_ERRORS = 10;

export async function getSystemErrors(
    {startAfter: startAfterDocId}:{ startAfter?: string; }): Promise<{ errors: SystemError[]; hasNextPage: boolean; }> {
    try {
        const errorsCollection = collection(db, 'error');
        let constraints = [];
        constraints.push(orderBy('timestamp', 'desc'));

        if (startAfterDocId) {
            const startDoc = await getDoc(doc(db, 'error', startAfterDocId));
            constraints.push(startAfter(startDoc));
        }

        constraints.push(limit(PAGE_SIZE_ERRORS + 1));

        const q = query(errorsCollection, ...constraints);
        const errorsSnapshot = await getDocs(q);
        const pageDocs = errorsSnapshot.docs;

        const hasNextPage = pageDocs.length > PAGE_SIZE_ERRORS;
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
        return {errors: [], hasNextPage: false};
    }
}

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

    } catch (e) {
        await logError('database', e, `getErrorDetails for id ${id}`);
        return null;
    }
}


// --- BUGS ---
const PAGE_SIZE_BUGS = 10;

export async function getReportedBugs({startAfter: startAfterDocId}: { startAfter?: string }): Promise<{
    bugs: BugReport[],
    hasNextPage: boolean
}> {
    const canView = await checkPermissions(['root.errors.view']);
    if (!canView) return {bugs: [], hasNextPage: false};

    try {
        const bugsCollection = collection(db, 'error');
        const constraints = [
            where('reportType', '==', 'submitted'),
            orderBy('timestamp', 'desc'),
        ];

        if (startAfterDocId) {
            const startDoc = await getDoc(doc(db, 'error', startAfterDocId));
            constraints.push(startAfter(startDoc));
        }

        constraints.push(limit(PAGE_SIZE_BUGS + 1));

        const q = query(bugsCollection, ...constraints);
        const snapshot = await getDocs(q);

        const pageDocs = snapshot.docs;
        const hasNextPage = pageDocs.length > PAGE_SIZE_BUGS;
        if (hasNextPage) {
            pageDocs.pop();
        }

        const bugs: BugReport[] = await Promise.all(pageDocs.map(async (doc) => {
            const data = doc.data();
            const reporterProfile = data.reported_by ? await getUserProfile(data.reported_by) : null;

            return {
                id: doc.id,
                reportedBy: reporterProfile?.displayName || data.reported_by || 'Anonymous',
                title: data.context,
                createdAt: data.timestamp?.toDate().toLocaleString() || 'N/A',
                status: data.status || 'new',
            };
        }));

        return {bugs, hasNextPage};

    } catch (error) {
        await logError('database', error, 'getReportedBugs');
        return {bugs: [], hasNextPage: false};
    }
}

export async function getBugDetails(id: string): Promise<BugReportDetails | null> {
    const canView = await checkPermissions(['root.errors.view']);
    if (!canView) return null;

    try {
        const bugRef = doc(db, 'error', id);
        const bugDoc = await getDoc(bugRef);

        if (!bugDoc.exists() || bugDoc.data().reportType !== 'submitted') {
            return null;
        }

        const data = bugDoc.data();
        const reporterProfile = data.reported_by ? await getUserProfile(data.reported_by) : null;

        return {
            id: bugDoc.id,
            reportedBy: reporterProfile?.displayName || 'Anonymous',
            reporterId: data.reported_by,
            title: data.context,
            description: data.message,
            createdAt: data.timestamp?.toDate().toLocaleString() || 'N/A',
            status: data.status || 'new',
        };
    } catch (error) {
        await logError('database', error, `getBugDetails: ${id}`);
        return null;
    }
}


export async function updateBugStatus(id: string, status: 'new' | 'in_progress' | 'solved'): Promise<{
    success: boolean;
    error?: string
}> {
    const canEdit = await checkPermissions(['root.errors.edit']);
    if (!canEdit) return {success: false, error: 'Permission denied.'};

    try {
        const bugRef = doc(db, 'error', id);
        await updateDoc(bugRef, {status});
        revalidatePath(`/manage/root/site/bugs/${id}`);
        revalidatePath('/manage/root/site/bugs');
        return {success: true};
    } catch (error) {
        await logError('database', error, `updateBugStatus: ${id}`);
        return {success: false, error: 'An unexpected error occurred.'};
    }
}


export async function deleteBugReport(id: string): Promise<{ success: boolean; error?: string }> {
    const canDelete = await checkPermissions(['root.errors.delete']);
    if (!canDelete) return {success: false, error: 'Permission denied.'};

    try {
        await deleteDoc(doc(db, 'error', id));
        revalidatePath('/manage/root/site/bugs');
        return {success: true};
    } catch (error) {
        await logError('database', error, `deleteBugReport: ${id}`);
        return {success: false, error: 'An unexpected error occurred.'};
    }
}
