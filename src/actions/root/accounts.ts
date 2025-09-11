

'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';
import type { UserProfile } from '@/lib/user';
import type { UserStats } from '@/types';

export type AccountListItem = {
    id: string; // accountId
    name: string;
    createdAt: string;
    type: string;
    isRoot: boolean;
};

export type GetAccountsResponse = {
    accounts: AccountListItem[];
    hasNextPage: boolean;
};

export async function getUserStats(): Promise<UserStats> {
    const canView = await checkPermissions(['root.dashboard.view']);
    if (!canView) return { totalUsers: 0, activeUsers: 0, signedUpToday: 0 };

    try {
        const twentyFourHoursAgo = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
        
        const accountsCollection = collection(db, 'account');
        const profilesCollection = collection(db, 'profile');

        const [accountsSnapshot, profilesSnapshot] = await Promise.all([
            getDocs(accountsCollection),
            getDocs(profilesCollection)
        ]);

        const totalUsers = accountsSnapshot.size;
        
        let signedUpToday = 0;
        profilesSnapshot.forEach(doc => {
            const createdAt = doc.data().createdAt;
            if (createdAt && createdAt.toDate() > twentyFourHoursAgo.toDate()) {
                signedUpToday++;
            }
        });

        // The logic for 'activeUsers' is a placeholder as we don't have a 'last_active' field.
        const activeUsers = Math.floor(totalUsers * 0.8); // Placeholder

        return { totalUsers, activeUsers, signedUpToday };

    } catch (error) {
        await logError('database', error, 'getUserStats');
        return { totalUsers: 0, activeUsers: 0, signedUpToday: 0 };
    }
}


export async function getAllAccounts(
  searchQuery: string,
  page: number,
  pageSize: number,
  sortKey: keyof AccountListItem,
  sortDirection: 'asc' | 'desc'
): Promise<GetAccountsResponse> {
    const canView = await checkPermissions(['root.account.view_full', 'root.account.view_limited1', 'root.account.view_limited2']);
    if (!canView) {
        return { accounts: [], hasNextPage: false };
    }

    try {
        const [accountSnapshot, profileSnapshot, permitSnapshot] = await Promise.all([
            getDocs(collection(db, 'account')),
            getDocs(collection(db, 'profile')),
            getDocs(query(collection(db, 'permit'), where('is_root', '==', true)))
        ]);

        const profileMap = new Map<string, UserProfile>();
        profileSnapshot.forEach(doc => {
            profileMap.set(doc.id, doc.data() as UserProfile);
        });

        const rootPermitMap = new Map<string, boolean>();
        permitSnapshot.forEach(doc => {
            rootPermitMap.set(doc.data().account_id, true);
        });

        let allAccounts: AccountListItem[] = accountSnapshot.docs.map(doc => {
            const accountId = doc.id;
            const accountData = doc.data();
            const profileData = profileMap.get(accountId);

            return {
                id: accountId,
                name: accountData?.displayName || 'Unnamed Account',
                createdAt: (profileData as any)?.createdAt?.toDate()?.toISOString() || new Date(0).toISOString(),
                type: accountData.type || 'individual',
                isRoot: rootPermitMap.has(accountId) || false,
            };
        });
        
        // Filter
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            allAccounts = allAccounts.filter(acc =>
                acc.name.toLowerCase().includes(lowercasedQuery) ||
                acc.id.toLowerCase().includes(lowercasedQuery) ||
                acc.type.toLowerCase().includes(lowercasedQuery)
            );
        }

        // Sort
        allAccounts.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            
            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;
            
            if (sortKey === 'createdAt') {
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
                createdAt: new Date(acc.createdAt).toLocaleDateString()
            })),
            hasNextPage: endIndex < allAccounts.length,
        };

    } catch (error) {
        await logError('database', error, 'getAllAccounts');
        return { accounts: [], hasNextPage: false };
    }
}
