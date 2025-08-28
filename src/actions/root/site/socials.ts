'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, setDoc, getDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';
import crypto from 'crypto';
import type { SocialLink } from '@/types';

const formSchema = z.object({
    type: z.enum(['instagram', 'linkedin', 'twitter', 'facebook', 'whatsapp', 'other']),
    url: z.string().url("Please enter a valid URL."),
});

const SOCIALS_DOC_ID = 'company_socials';

// --- Read ---
export async function getSocialLinks(): Promise<SocialLink[]> {
    const canView = await checkPermissions(['root.site.social_accounts.read']);
    if (!canView) return [];

    try {
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().links) {
            return docSnap.data().links as SocialLink[];
        }
        return [];

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
    const newLink: SocialLink = { id: crypto.randomUUID(), type, url, isVisible: true };
    
    try {
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, { links: arrayUnion(newLink) });
        } else {
            await setDoc(docRef, { links: [newLink] });
        }

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
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const links = (docSnap.data().links || []) as SocialLink[];
            const updatedLinks = links.map(link => 
                link.id === id ? { ...link, isVisible: !link.isVisible } : link
            );
            await updateDoc(docRef, { links: updatedLinks });
            revalidatePath('/manage/root/site/socials');
            return { success: true };
        }
        return { success: false, error: 'Social links document not found.' };

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
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const links = (docSnap.data().links || []) as SocialLink[];
            const linkToDelete = links.find(link => link.id === id);
            
            if (linkToDelete) {
                await updateDoc(docRef, { links: arrayRemove(linkToDelete) });
                revalidatePath('/manage/root/site/socials');
                return { success: true };
            }
        }
        return { success: false, error: 'Link not found.' };
    } catch (error) {
        await logError('database', error, `deleteSocialLink: ${id}`);
        return { success: false, error: 'Failed to delete link.' };
    }
}
