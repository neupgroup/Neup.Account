'use server';

import prisma from '@/lib/prisma';
import {revalidatePath} from 'next/cache';
import {logError} from '@/lib/logger';
import {checkPermissions, getUserProfile} from '@/lib/user';
import type {SystemError, SystemErrorDetails, BugReport, BugReportDetails} from '@/types';


// --- ERRORS ---
const PAGE_SIZE_ERRORS = 10;

export async function getSystemErrors(
    {startAfter: startAfterDocId}:{ startAfter?: string; }): Promise<{ errors: SystemError[]; hasNextPage: boolean; }> {
    try {
        const canView = await checkPermissions(['root.errors.view']);
        if (!canView) return { errors: [], hasNextPage: false };

        const logs = await prisma.errorLog.findMany({
            where: { type: { not: 'submitted' } },
            orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
            ...(startAfterDocId
                ? { cursor: { id: startAfterDocId }, skip: 1 }
                : {}),
            take: PAGE_SIZE_ERRORS + 1,
        });

        const hasNextPage = logs.length > PAGE_SIZE_ERRORS;
        const pageLogs = hasNextPage ? logs.slice(0, PAGE_SIZE_ERRORS) : logs;

        const errors: SystemError[] = pageLogs.map((log) => {
            const timestamp = log.timestamp.toLocaleString();
            return {
                id: log.id,
                type: log.type as any,
                context: log.context,
                message: log.message.split('\n')[0], // Show first line only
                timestamp: timestamp,
                status: log.status as 'new' | 'in_progress' | 'solved',
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
         const canView = await checkPermissions(['root.errors.view']);
        if (!canView) return null;

        const log = await prisma.errorLog.findUnique({ where: { id } });
        if (!log) return null;

        let user;
        if (log.accountId) {
            const userProfile = await getUserProfile(log.accountId);
            user = {
                name: userProfile?.nameDisplay || 'Unknown User',
                neupId: userProfile?.neupIdPrimary || 'N/A'
            }
        }

        return {
            id: log.id,
            type: log.type as any,
            context: log.context,
            message: log.message.split('\n')[0],
            fullError: log.message,
            timestamp: log.timestamp.toLocaleString(),
            status: log.status as 'new' | 'in_progress' | 'solved',
            user,
            ipAddress: log.ipAddress ?? undefined,
            geolocation: log.geolocation ?? undefined,
            reproSteps: log.reproSteps ?? undefined,
            solution: log.solution ?? undefined,
            solvedBy: log.solvedBy ?? undefined,
            problemLevel: log.problemLevel as any
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
        const bugs = await prisma.bugReport.findMany({
            where: { reportType: 'submitted' },
            orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
            ...(startAfterDocId
                ? { cursor: { id: startAfterDocId }, skip: 1 }
                : {}),
            take: PAGE_SIZE_BUGS + 1,
        });

        const hasNextPage = bugs.length > PAGE_SIZE_BUGS;
        const pageBugs = hasNextPage ? bugs.slice(0, PAGE_SIZE_BUGS) : bugs;

        const bugReports: BugReport[] = await Promise.all(pageBugs.map(async (bug) => {
            const reporterProfile = bug.reportedBy ? await getUserProfile(bug.reportedBy) : null;

            return {
                id: bug.id,
                reportedBy: reporterProfile?.nameDisplay || bug.reportedBy || 'Anonymous',
                title: bug.context,
                description: bug.message,
                createdAt: bug.timestamp.toLocaleString(),
                status: bug.status as 'new' | 'in_progress' | 'solved',
            };
        }));

        return {bugs: bugReports, hasNextPage};

    } catch (error) {
        await logError('database', error, 'getReportedBugs');
        return {bugs: [], hasNextPage: false};
    }
}

export async function getBugDetails(id: string): Promise<BugReportDetails | null> {
    const canView = await checkPermissions(['root.errors.view']);
    if (!canView) return null;

    try {
        const bug = await prisma.bugReport.findUnique({ where: { id } });
        if (!bug || bug.reportType !== 'submitted') {
            return null;
        }

        const reporterProfile = bug.reportedBy ? await getUserProfile(bug.reportedBy) : null;

        return {
            id: bug.id,
            reportedBy: reporterProfile?.nameDisplay || 'Anonymous',
            reporterId: bug.reportedBy ?? '',
            title: bug.context,
            description: bug.message,
            createdAt: bug.timestamp.toLocaleString(),
            status: bug.status as 'new' | 'in_progress' | 'solved',
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
        await prisma.bugReport.update({ where: { id }, data: { status } });
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
        await prisma.bugReport.delete({ where: { id } });
        revalidatePath('/manage/root/site/bugs');
        return {success: true};
    } catch (error) {
        await logError('database', error, `deleteBugReport: ${id}`);
        return {success: false, error: 'An unexpected error occurred.'};
    }
}
