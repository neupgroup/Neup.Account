'use server';

import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { checkPermissions } from '@/services/user';
import { getPersonalAccountId } from '@/core/auth/verify';
import type { StoredAccount } from '@/core/auth/session';

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
    lastActive: Date | null;
};

/**
 * Type AccountBasicsWithCapabilities - extends AccountBasics with capabilities array.
 */
export type AccountBasicsWithCapabilities = AccountBasics & {
    capabilities: string[];
};

/**
 * Type AccessibleAccount - extends StoredAccount with display fields.
 */
export type AccessibleAccount = StoredAccount & {
    displayName: string;
    displayPhoto?: string;
    isBrand: boolean;
    isDependent: boolean;
    accountType: string;
    active: boolean;
};


/**
 * Function getAccessibleAccounts.
 *
 * Returns accounts that the current personal account has been granted access to.
 * Deduplicates by ownerAccountId to prevent duplicate entries.
 */
export async function getAccessibleAccounts(): Promise<AccessibleAccount[]> {
    const personalAccountId = await getPersonalAccountId();
    if (!personalAccountId) return [];

    try {
        // Query authzAccountAccessGrant: ownerAccountId is the account being managed,
        // targetAccountId is the account that has been granted access (the accessor).
        const grants = await prisma.authzAccountAccessGrant.findMany({
            where: {
                targetAccountId: personalAccountId,
                appId: 'neup.account',
            },
            include: {
                owner: {
                    include: {
                        neupIds: {
                            where: { isPrimary: true },
                        },
                    },
                },
            },
        });

        const seen = new Set<string>();
        const accounts = grants.map((grant) => {
            const ownerAccount = grant.owner;
            if (!ownerAccount) return null;
            // Skip duplicate grants for the same owner account
            if (seen.has(ownerAccount.id)) return null;
            seen.add(ownerAccount.id);

            const neupId = ownerAccount.neupIds[0]?.id || 'unknown';
            const displayName = ownerAccount.displayName || 'Unnamed Account';

            const accessibleAccount: AccessibleAccount = {
                aid: ownerAccount.id,
                def: 0,
                sid: '',
                skey: '',
                neupId,
                active: false,
                isBrand: ownerAccount.accountType === 'brand',
                isDependent: ownerAccount.accountType === 'dependent',
                accountType: ownerAccount.accountType,
                displayName,
                displayPhoto: ownerAccount.displayImage || undefined,
            };
            return accessibleAccount;
        });

        return accounts.filter((acc): acc is AccessibleAccount => acc !== null);

    } catch (error) {
        await logError('database', error, 'getAccessibleAccounts');
        return [];
    }
}


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
 * Function getAllAccounts.
 *
 * Returns all accounts in the system regardless of type.
 * Requires root.account.view permission.
 */
export async function getAllAccounts(): Promise<AccountBasics[]> {
    const canView = await checkPermissions(['root.account.view']);
    if (!canView) return [];

    try {
        const accounts = await prisma.account.findMany({
            select: {
                id: true,
                displayName: true,
                displayImage: true,
                status: true,
                isVerified: true,
                accountType: true,
                lastActive: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return accounts.map((a) => ({
            id: a.id,
            displayName: a.displayName,
            displayImage: a.displayImage,
            status: a.status,
            isVerified: a.isVerified,
            accountType: a.accountType,
            lastActive: a.lastActive,
        }));
    } catch (error) {
        await logError('database', error, 'getAllAccounts');
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
                lastActive: true,
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
                lastActive: a.lastActive,
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
                lastActive: true,
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
            lastActive: account.lastActive,
        };
    } catch (error) {
        await logError('database', error, `getAccountBasics:${accountId}`);
        return null;
    }
}


/**
 * Function getCapabilitiesForAccountPair.
 *
 * Returns the deduplicated list of capabilities that `accessorId` holds
 * on `ownerAccountId`, by joining authzAccountAccessGrant → authzRoleCapability.
 */
async function getCapabilitiesForAccountPair(
    accessorId: string,
    ownerAccountId: string,
): Promise<string[]> {
    try {
        const grants = await prisma.authzAccountAccessGrant.findMany({
            where: {
                targetAccountId: accessorId,
                ownerAccountId,
                appId: 'neup.account',
            },
            select: { roleId: true },
        });

        if (grants.length === 0) return [];

        const roleIds = Array.from(new Set(grants.map((g) => g.roleId)));

        const roleCapabilities = await prisma.authzRoleCapability.findMany({
            where: {
                roleId: { in: roleIds },
                appId: 'neup.account',
            },
            select: { denormalizedCapability: true },
        });

        const capabilities = roleCapabilities.flatMap((row) => {
            if (!Array.isArray(row.denormalizedCapability)) return [];
            return row.denormalizedCapability.filter(
                (item): item is string => typeof item === 'string',
            );
        });

        return Array.from(new Set(capabilities));
    } catch (error) {
        await logError('database', error, `getCapabilitiesForAccountPair:${accessorId}:${ownerAccountId}`);
        return [];
    }
}


/**
 * Function getAccessableAccountsWithCapabilities.
 *
 * Like getAccessableAccounts, but each entry also includes the capabilities
 * the caller holds on that specific account.
 */
export async function getAccessableAccountsWithCapabilities(
    accountId: string,
): Promise<AccountBasicsWithCapabilities[]> {
    try {
        const ids = await getAccessableAccountIds(accountId);
        if (ids.length === 0) return [];

        const [accountRows, allGrants] = await Promise.all([
            prisma.account.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    displayName: true,
                    displayImage: true,
                    status: true,
                    isVerified: true,
                    accountType: true,
                    lastActive: true,
                },
            }),
            // Fetch all grants for this accessor across all owner accounts in one query
            prisma.authzAccountAccessGrant.findMany({
                where: {
                    targetAccountId: accountId,
                    ownerAccountId: { in: ids },
                    appId: 'neup.account',
                },
                select: { ownerAccountId: true, roleId: true },
            }),
        ]);

        // Collect all unique roleIds so we can batch-fetch capabilities
        const allRoleIds = Array.from(new Set(allGrants.map((g) => g.roleId)));

        const roleCapabilityRows = allRoleIds.length > 0
            ? await prisma.authzRoleCapability.findMany({
                where: {
                    roleId: { in: allRoleIds },
                    appId: 'neup.account',
                },
                select: { roleId: true, denormalizedCapability: true },
            })
            : [];

        // Build roleId → capabilities map
        const roleCapMap = new Map<string, string[]>();
        for (const row of roleCapabilityRows) {
            if (!Array.isArray(row.denormalizedCapability)) continue;
            const caps = row.denormalizedCapability.filter(
                (c): c is string => typeof c === 'string',
            );
            roleCapMap.set(row.roleId, caps);
        }

        // Build ownerAccountId → capabilities map
        const ownerCapMap = new Map<string, Set<string>>();
        for (const grant of allGrants) {
            if (!ownerCapMap.has(grant.ownerAccountId)) {
                ownerCapMap.set(grant.ownerAccountId, new Set());
            }
            const caps = roleCapMap.get(grant.roleId) ?? [];
            for (const cap of caps) {
                ownerCapMap.get(grant.ownerAccountId)!.add(cap);
            }
        }

        const seen = new Set<string>();
        return accountRows
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
                lastActive: a.lastActive,
                capabilities: Array.from(ownerCapMap.get(a.id) ?? []),
            }));
    } catch (error) {
        await logError('database', error, `getAccessableAccountsWithCapabilities:${accountId}`);
        return [];
    }
}


/**
 * Function getAccessableBrandAccountsWithCapabilities.
 *
 * Like getAccessableBrandAccounts, but each entry also includes the capabilities
 * the caller holds on that specific brand/branch account.
 */
export async function getAccessableBrandAccountsWithCapabilities(
    accountId: string,
): Promise<AccountBasicsWithCapabilities[]> {
    try {
        const ids = await getAccessableAccountIds(accountId);
        if (ids.length === 0) return [];

        const [brandRows, allGrants] = await Promise.all([
            prisma.account.findMany({
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
                    lastActive: true,
                },
            }),
            prisma.authzAccountAccessGrant.findMany({
                where: {
                    targetAccountId: accountId,
                    ownerAccountId: { in: ids },
                    appId: 'neup.account',
                },
                select: { ownerAccountId: true, roleId: true },
            }),
        ]);

        const brandIds = new Set(brandRows.map((b) => b.id));

        // Only keep grants for brand/branch accounts
        const relevantGrants = allGrants.filter((g) => brandIds.has(g.ownerAccountId));

        const allRoleIds = Array.from(new Set(relevantGrants.map((g) => g.roleId)));

        const roleCapabilityRows = allRoleIds.length > 0
            ? await prisma.authzRoleCapability.findMany({
                where: {
                    roleId: { in: allRoleIds },
                    appId: 'neup.account',
                },
                select: { roleId: true, denormalizedCapability: true },
            })
            : [];

        const roleCapMap = new Map<string, string[]>();
        for (const row of roleCapabilityRows) {
            if (!Array.isArray(row.denormalizedCapability)) continue;
            const caps = row.denormalizedCapability.filter(
                (c): c is string => typeof c === 'string',
            );
            roleCapMap.set(row.roleId, caps);
        }

        const ownerCapMap = new Map<string, Set<string>>();
        for (const grant of relevantGrants) {
            if (!ownerCapMap.has(grant.ownerAccountId)) {
                ownerCapMap.set(grant.ownerAccountId, new Set());
            }
            const caps = roleCapMap.get(grant.roleId) ?? [];
            for (const cap of caps) {
                ownerCapMap.get(grant.ownerAccountId)!.add(cap);
            }
        }

        const seen = new Set<string>();
        return brandRows
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
                lastActive: a.lastActive,
                capabilities: Array.from(ownerCapMap.get(a.id) ?? []),
            }));
    } catch (error) {
        await logError('database', error, `getAccessableBrandAccountsWithCapabilities:${accountId}`);
        return [];
    }
}
