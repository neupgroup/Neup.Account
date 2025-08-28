
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';
import type { SearchResult } from '@/types';


// A very basic search function. In a real-world scenario,
// you would use a dedicated search service like Algolia, Typesense, or Elasticsearch.
export async function searchAll(query: string): Promise<SearchResult[]> {
    const lowercasedQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search Users
    const canSearchUsers = await checkPermissions(['root.account.search']);
    if (canSearchUsers) {
        try {
            const profilesSnapshot = await getDocs(collection(db, 'profile'));
            const neupidsSnapshot = await getDocs(collection(db, 'neupid'));
            
            const neupIdMap = new Map<string, string>();
            neupidsSnapshot.forEach(doc => {
                neupIdMap.set(doc.data().for, doc.id);
            });

            profilesSnapshot.forEach(doc => {
                const data = doc.data();
                const neupId = neupIdMap.get(doc.id) || '';
                const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
                const displayName = data.displayName || '';

                if (
                    neupId.toLowerCase().includes(lowercasedQuery) ||
                    fullName.toLowerCase().includes(lowercasedQuery) ||
                    displayName.toLowerCase().includes(lowercasedQuery)
                ) {
                    results.push({
                        id: `user-${doc.id}`,
                        type: 'user',
                        title: displayName || fullName,
                        description: `@${neupId}`,
                        url: `/manage/root/accounts/${doc.id}`,
                    });
                }
            });
        } catch (error) {
            await logError('database', error, 'searchAll:users');
        }
    }

    // Search Permissions
    const canSearchPermissions = await checkPermissions(['root.permission.view']);
    if (canSearchPermissions) {
        try {
            const permissionsSnapshot = await getDocs(collection(db, 'permission'));
            permissionsSnapshot.forEach(doc => {
                const data = doc.data();
                if (
                    data.name.toLowerCase().includes(lowercasedQuery) ||
                    data.description.toLowerCase().includes(lowercasedQuery) ||
                    data.app_id.toLowerCase().includes(lowercasedQuery) ||
                    data.access?.some((p: string) => p.toLowerCase().includes(lowercasedQuery))
                ) {
                    results.push({
                        id: `permission-${doc.id}`,
                        type: 'permission',
                        title: data.name,
                        description: data.description,
                        url: `/manage/root/permission/${doc.id}`,
                    });
                }
            });
        } catch (error) {
            await logError('database', error, 'searchAll:permissions');
        }
    }
    
    return results;
}
