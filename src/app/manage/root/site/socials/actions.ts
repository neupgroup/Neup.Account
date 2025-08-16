

'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user-actions';

export type SocialLink = {
    id: string;
    type: 'instagram' | 'linkedin' | 'twitter' | 'facebook' | 'whatsapp' | 'other';
    url: string;
    isVisible: boolean;
};

const formSchema = z.object({
    type: z.enum(['instagram', 'linkedin', 'twitter', 'facebook', 'whatsapp', 'other']),
    url: z.string().url("Please enter a valid URL."),
});

// --- Read ---
export async function getSocialLinks(): Promise<SocialLink[]> {
    const canView = await checkPermissions(['root.site.social_accounts.read']);
    if (!canView) return [];

    try {
        const linksCollection = collection(db, 'system_socials');
        const q = query(linksCollection, orderBy('type'));
        const querySnapshot = await getDocs(q);
        
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as SocialLink));

    } catch (error) {
        await logError('database', error, 'getSocialLinks');
        return [];
    }
}

// --- Create ---
export async function addSocialLink(formData: FormData): Promise<{ success: boolean; error?: string; newLink?: SocialLink }> {
    const canAdd = await checkPermissions(['root.site.social_accounts.add']);
    if (!canAdd) return { success: false, error: 'Permission denied.' };
    
    const rawData = Object.fromEntries(formData.entries());
    const validation = formSchema.safeParse(rawData);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.url?.[0] || validation.error.flatten().fieldErrors.type?.[0] };
    }

    const { type, url } = validation.data;
    
    try {
        const newDocRef = await addDoc(collection(db, 'system_socials'), {
            type,
            url,
            isVisible: true,
        });

        const newLink: SocialLink = { id: newDocRef.id, type, url, isVisible: true };
        revalidatePath('/manage/root/site/socials');
        return { success: true, newLink };

    } catch (error) {
        await logError('database', error, 'addSocialLink');
        return { success: false, error: 'Failed to add new link.' };
    }
}

// --- Update ---
export async function toggleSocialLinkVisibility(id: string, isVisible: boolean): Promise<{ success: boolean; error?: string }> {
    const canEdit = await checkPermissions(['root.site.social_accounts.edit']);
    if (!canEdit) return { success: false, error: 'Permission denied.' };

    try {
        const docRef = doc(db, 'system_socials', id);
        await updateDoc(docRef, { isVisible });
        revalidatePath('/manage/root/site/socials');
        return { success: true };
    } catch (error) {
        await logError('database', error, `toggleSocialLinkVisibility: ${id}`);
        return { success: false, error: 'Failed to update visibility.' };
    }
}

// --- Delete ---
export async function deleteSocialLink(id: string): Promise<{ success: boolean; error?: string }> {
    const canDelete = await checkPermissions(['root.site.social_accounts.delete']);
    if (!canDelete) return { success: false, error: 'Permission denied.' };

    try {
        await deleteDoc(doc(db, 'system_socials', id));
        revalidatePath('/manage/root/site/socials');
        return { success: true };
    } catch (error) {
        await logError('database', error, `deleteSocialLink: ${id}`);
        return { success: false, error: 'Failed to delete link.' };
    }
}
