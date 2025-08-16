
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getPersonalAccountId, checkPermissions } from '@/lib/user-actions';
import { logError } from '@/lib/logger';
import { getUserProfile } from '@/lib/user-actions';
import { cookies } from 'next/headers';

export type BrandAccount = {
    id: string;
    name: string;
    logoUrl?: string;
    plan: string;
};

export async function getBrandAccounts(): Promise<BrandAccount[]> {
    const canView = await checkPermissions(['linked_accounts.brand.view']);
    if (!canView) return [];
    
    const creatorAccountId = await getPersonalAccountId();
    if (!creatorAccountId) {
        return [];
    }

    try {
        const accountRef = collection(db, 'account');
        const q = query(accountRef, where('managedBy', 'array-contains', creatorAccountId), where('type', '==', 'brand'));
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const brandAccounts = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
                const brandAccountId = doc.id;
                const profile = await getUserProfile(brandAccountId);

                if (!profile) return null;

                return {
                    id: brandAccountId,
                    name: profile.displayName || 'Unnamed Brand',
                    logoUrl: profile.displayPhoto,
                    plan: "Business" // Placeholder for plan
                };
            })
        );
        
        return brandAccounts.filter((account): account is BrandAccount => account !== null);

    } catch (error) {
        await logError('database', error, 'getBrandAccounts');
        return [];
    }
}

export async function switchToBrand(brandId: string) {
    const canManage = await checkPermissions(['linked_accounts.brand.manage']);
    if (!canManage) return { success: false, error: "Permission denied." };
    
    const cookieStore = cookies();
    const SESSION_DURATION_DAYS = 30;
    const expiresOn = new Date();
    expiresOn.setDate(expiresOn.getDate() + SESSION_DURATION_DAYS);
    const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

    cookieStore.set('auth_managing', `brand.${brandId}`, cookieOptions);
    return { success: true };
}

export async function switchToPersonal() {
    const cookieStore = cookies();
    cookieStore.delete('auth_managing');
}
