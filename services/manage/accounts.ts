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
    roles: string[];
    capabilities: string[];
};

/**
 * Type GetAccountsResponse.
 */
export type GetAccountsResponse = {
    accounts: AccountListItem[];
    hasNextPage: boolean;
};

/**
 * Type AccountBasics.
 */
export type AccountBasics = {
    id: string;
    displayName: string | null;
    displayImage: string | null;
    status: string | null;
    isVerified: boolean;
    accountType: string;
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
 * Function getAccessableAccountIds.
 *
 * Returns a deduplicated array of account IDs that the given accountId
 * has access to — i.e. all unique ownerAccountIds from authz_account_access_grant
 * where targetAccountId = accountId and app_id = 'neup.account'.
 */
export async function getAccessableAccountIds(accountId: string): Promise<string[]> {
    try {
        const grants = await prisma.authzAccountAccessGrant.findMany({
            where: {
                targetAccountId: accountId,
                appId: 'neup.account',
            },
            select: { ownerAccountId: true },
            distinct: ['ownerAccountId'],
        });

        return grants.map((g) => g.ownerAccountId);
    } catch (error) {
        await logError('database', error, `getAccessableAccountIds:${accountId}`);
        return [];
    }
}


/**
 * Function getAccessableAccounts.
 *
 * Calls getAccessableAccountIds, then fetches basic details for each unique
 * account via getAccountBasics. Returns AccountBasics[] — one entry per account,
 * deduplicated by id.
 */
export async function getAccessableAccounts(accountId: string): Promise<AccountBasics[]> {
    try {
        const ids = await getAccessableAccountIds(accountId);
        if (ids.length === 0) return [];

        const results = await Promise.all(ids.map((id) => getAccountBasics(id)));

        // Filter nulls and deduplicate by id
        const seen = new Set<string>();
        return results.filter((a): a is AccountBasics => {
            if (!a || seen.has(a.id)) return false;
            seen.add(a.id);
            return true;
        });
    } catch (error) {
        await logError('database', error, `getAccessableAccounts:${accountId}`);
        return [];
    }
}


/**
 * Function getAccessableBrandAccounts.
 *
 * Calls getAccessableAccountIds, then filters to only accounts whose
 * accountType is 'brand' or 'branch'. Returns AccountBasics[] deduplicated by id.
 */
export async function getAccessableBrandAccounts(accountId: string): Promise<AccountBasics[]> {
    try {
        const ids = await getAccessableAccountIds(accountId);
        if (ids.length === 0) return [];

        const brandAccounts = await prisma.account.findMany({
            where: {
                id: { in: ids },
                accountType: { in: ['brand', 'branch'] },
            },
            select: {
                id: true,
                displayName: true,
                displayImage: true,
                status: true,
                isVerified: true,
                accountType: true,
            },
        });

        const seen = new Set<string>();
        return brandAccounts
            .filter((a) => {
                if (seen.has(a.id)) return false;
                seen.add(a.id);
                return true;
            })
            .map((a) => ({
                id: a.id,
                displayName: a.displayName,
                displayImage: a.displayImage,
                status: a.status,
                isVerified: a.isVerified,
                accountType: a.accountType,
            }));
    } catch (error) {
        await logError('database', error, `getAccessableBrandAccounts:${accountId}`);
        return [];
    }
}


/**
 * Function getAccountBasics.
 *
 * Returns basic account information for a given accountId.
 */
export async function getAccountBasics(accountId: string): Promise<AccountBasics | null> {
    try {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                displayName: true,
                displayImage: true,
                status: true,
                isVerified: true,
                accountType: true,
            },
        });

        if (!account) return null;

        return {
            id: account.id,
            displayName: account.displayName,
            displayImage: account.displayImage,
            status: account.status,
            isVerified: account.isVerified,
            accountType: account.accountType,
        };
    } catch (error) {
        await logError('database', error, `getAccountBasics:${accountId}`);
        return null;
    }
}
