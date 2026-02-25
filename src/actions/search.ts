
'use server';

import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';
import type { SearchResult } from '@/types';
import prisma from '@/lib/prisma';


// A very basic search function. In a real-world scenario,
// you would use a dedicated search service like Algolia, Typesense, or Elasticsearch.
export async function searchAll(query: string): Promise<SearchResult[]> {
    const lowercasedQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search Users
    const canSearchUsers = await checkPermissions(['root.account.search']);
    if (canSearchUsers) {
        try {
            const accountsByName = await prisma.account.findMany({
                where: {
                    OR: [
                        { nameDisplay: { contains: lowercasedQuery, mode: 'insensitive' } },
                        { nameFirst: { contains: lowercasedQuery, mode: 'insensitive' } },
                        { nameLast: { contains: lowercasedQuery, mode: 'insensitive' } },
                    ],
                },
                select: { id: true, nameFirst: true, nameLast: true, nameDisplay: true },
                take: 100,
            });

            const neupIds = await prisma.neupId.findMany({
                where: { id: { contains: lowercasedQuery, mode: 'insensitive' } },
                select: { id: true, accountId: true },
                take: 100,
            });

            const accountIdToNeupId = new Map<string, string>();
            for (const n of neupIds) accountIdToNeupId.set(n.accountId, n.id);

            const seenAccounts = new Set<string>();

            for (const acc of accountsByName) {
                const fullName = `${acc.nameFirst || ''} ${acc.nameLast || ''}`.trim();
                const displayName = acc.nameDisplay || '';
                const neupId = accountIdToNeupId.get(acc.id) || '';
                seenAccounts.add(acc.id);
                results.push({
                    id: `user-${acc.id}`,
                    type: 'user',
                    title: displayName || fullName,
                    description: neupId ? `@${neupId}` : '',
                    url: `/manage/root/accounts/${acc.id}`,
                });
            }

            for (const n of neupIds) {
                if (seenAccounts.has(n.accountId)) continue;
                const acc = await prisma.account.findUnique({
                    where: { id: n.accountId },
                    select: { id: true, nameFirst: true, nameLast: true, nameDisplay: true },
                });
                if (!acc) continue;
                const fullName = `${acc.nameFirst || ''} ${acc.nameLast || ''}`.trim();
                const displayName = acc.nameDisplay || '';
                results.push({
                    id: `user-${acc.id}`,
                    type: 'user',
                    title: displayName || fullName || `@${n.id}`,
                    description: `@${n.id}`,
                    url: `/manage/root/accounts/${acc.id}`,
                });
            }
        } catch (error) {
            await logError('database', error, 'searchAll:users');
        }
    }

    // Search Permissions
    const canSearchPermissions = await checkPermissions(['root.permission.view']);
    if (canSearchPermissions) {
        try {
            const perms = await prisma.permission.findMany({
                where: {
                    OR: [
                        { name: { contains: lowercasedQuery, mode: 'insensitive' } },
                        { appId: { contains: lowercasedQuery, mode: 'insensitive' } },
                    ],
                },
                orderBy: { name: 'asc' },
                take: 200,
            });

            for (const p of perms) {
                const accessMatches = p.access.some(a => a.toLowerCase().includes(lowercasedQuery));
                if (
                    accessMatches ||
                    p.name.toLowerCase().includes(lowercasedQuery) ||
                    (p.appId || '').toLowerCase().includes(lowercasedQuery)
                ) {
                    results.push({
                        id: `permission-${p.id}`,
                        type: 'permission',
                        title: p.name,
                        description: `Permissions for ${p.appId || 'default'}`,
                        url: `/manage/root/permission/${p.id}`,
                    });
                }
            }
        } catch (error) {
            await logError('database', error, 'searchAll:permissions');
        }
    }
    
    return results;
}
