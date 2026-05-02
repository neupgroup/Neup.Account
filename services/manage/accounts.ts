

'use server';

import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { checkPermissions } from '@/services/user';

export type UserStats = {
    totalUsers: number;
    activeUsers: number;
    signedUpToday: number;
};

/**
 * Type AccountListItem.
 */
export type AccountListItem = {
    id: string; // accountId
    name: string;
    dateCreated: string;
    accountType: string;
    isRoot: boolean;
};


/**
 * Type GetAccountsResponse.
 */
export type GetAccountsResponse = {
    accounts: AccountListItem[];
    hasNextPage: boolean;
};


/**
 * Function getUserStats.
 */
export async function getUserStats(): Promise<UserStats> {
    const canView = await checkPermissions(['root.dashboard.view']);
    if (!canView) return { totalUsers: 0, activeUsers: 0, signedUpToday: 0 };

    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [totalUsers, signedUpToday] = await Promise.all([
            prisma.account.count(),
            prisma.account.count({
                where: { createdAt: { gte: twentyFourHoursAgo } },
            }),
        ]);
        // Placeholder for active users until a proper metric exists
        const activeUsers = Math.floor(totalUsers * 0.8);
        return { totalUsers, activeUsers, signedUpToday };

    } catch (error) {
        await logError('database', error, 'getUserStats');
        return { totalUsers: 0, activeUsers: 0, signedUpToday: 0 };
    }
}


/**
 * Function getAllAccounts.
 */
export async function getAllAccounts(
  searchQuery: string,
  page: number,
  pageSize: number,
  sortKey: keyof AccountListItem,
  sortDirection: 'asc' | 'desc'
): Promise<GetAccountsResponse> {
    const canView = await checkPermissions(['root.account.view']);
    if (!canView) {
        return { accounts: [], hasNextPage: false };
    }

    try {
        const [accounts, rootPermits] = await Promise.all([
            prisma.account.findMany({
                select: {
                    id: true,
                    displayName: true,
                    createdAt: true,
                    accountType: true,
                },
            }),
            prisma.permit.findMany({
                where: { isRoot: true },
                select: { accountId: true },
            }),
        ]);

        const rootSet = new Set(rootPermits.map(p => p.accountId));

        let allAccounts: AccountListItem[] = accounts.map(a => ({
            id: a.id,
            name: a.displayName || 'Unnamed Account',
            dateCreated: (a.createdAt ?? new Date(0)).toISOString(),
            accountType: a.accountType || 'individual',
            isRoot: rootSet.has(a.id),
        }));
        
        // Filter
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            allAccounts = allAccounts.filter(acc =>
                acc.name.toLowerCase().includes(lowercasedQuery) ||
                acc.id.toLowerCase().includes(lowercasedQuery) ||
                acc.accountType.toLowerCase().includes(lowercasedQuery)
            );
        }

        // Sort
        allAccounts.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            
            if (sortKey === 'dateCreated') {
                const dateA = new Date(aValue as string).getTime();
                const dateB = new Date(bValue as string).getTime();
                if (dateA < dateB) return sortDirection === 'asc' ? -1 : 1;
                if (dateA > dateB) return sortDirection === 'asc' ? 1 : -1;
                return 0;
            }
            
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Paginate
        const startIndex = (page - 1) * pageSize;
        const endIndex = page * pageSize;
        const paginatedAccounts = allAccounts.slice(startIndex, endIndex);

        return {
            accounts: paginatedAccounts.map(acc => ({
                ...acc,
                dateCreated: new Date(acc.dateCreated).toLocaleDateString()
            })),
            hasNextPage: endIndex < allAccounts.length,
        };

    } catch (error) {
        await logError('database', error, 'getAllAccounts');
        return { accounts: [], hasNextPage: false };
    }
}
