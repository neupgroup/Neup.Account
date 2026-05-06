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
    id: string;
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
        // Fetch all accounts (one row per account — no joins, no duplicates)
        const accounts = await prisma.account.findMany({
            select: {
                id: true,
                displayName: true,
                createdAt: true,
                accountType: true,
            },
        });

        // Fetch the set of account IDs that hold a root-scoped role — single query
        const rootGrants = await prisma.authzAccountAccessGrant.findMany({
            where: {
                appId: 'neup.account',
                role: { scope: 'root' },
            },
            select: { targetAccountId: true },
            distinct: ['targetAccountId'],
        });
        const rootAccountIds = new Set(rootGrants.map((g) => g.targetAccountId));

        let allAccounts: AccountListItem[] = accounts.map((a) => ({
            id: a.id,
            name: a.displayName || 'Unnamed Account',
            dateCreated: (a.createdAt ?? new Date(0)).toISOString(),
            accountType: a.accountType || 'individual',
            isRoot: rootAccountIds.has(a.id),
        }));

        // Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            allAccounts = allAccounts.filter((acc) =>
                acc.name.toLowerCase().includes(q) ||
                acc.id.toLowerCase().includes(q) ||
                acc.accountType.toLowerCase().includes(q)
            );
        }

        // Sort
        allAccounts.sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (sortKey === 'dateCreated') {
                const diff = new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
                return sortDirection === 'asc' ? diff : -diff;
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Paginate
        const startIndex = (page - 1) * pageSize;
        const paginatedAccounts = allAccounts.slice(startIndex, startIndex + pageSize);

        return {
            accounts: paginatedAccounts.map((acc) => ({
                ...acc,
                dateCreated: new Date(acc.dateCreated).toLocaleDateString(),
            })),
            hasNextPage: startIndex + pageSize < allAccounts.length,
        };

    } catch (error) {
        await logError('database', error, 'getAllAccounts');
        return { accounts: [], hasNextPage: false };
    }
}
