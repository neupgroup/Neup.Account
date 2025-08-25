
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, startAfter, endBefore, limit } from 'firebase/firestore';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user-actions';
import { getUserProfile } from '@/actions/root/users';


// --- SOCIALS ---

export type SocialLink = {
    id: string;
    type: 'instagram' | 'linkedin' | 'twitter' | 'facebook' | 'whatsapp' | 'other';
    url: string;
    isVisible: boolean;
};

const socialFormSchema = z.object({
    type: z.enum(['instagram', 'linkedin', 'twitter', 'facebook', 'whatsapp', 'other']),
    url: z.string().url("Please enter a valid URL."),
});

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

export async function addSocialLink(formData: FormData): Promise<{ success: boolean; error?: string; newLink?: SocialLink }> {
    const canAdd = await checkPermissions(['root.site.social_accounts.add']);
    if (!canAdd) return { success: false, error: 'Permission denied.' };
    
    const rawData = Object.fromEntries(formData.entries());
    const validation = socialFormSchema.safeParse(rawData);
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


// --- ERRORS ---
const PAGE_SIZE = 10;

export type SystemError = {
    id: string;
    type: 'ai' | 'database' | 'validation' | 'auth' | 'unknown';
    context: string;
    message: string;
    timestamp: string;
    status: 'new' | 'in_progress' | 'solved';
};

export type SystemErrorDetails = SystemError & {
    fullError: string;
    user?: {
        name: string;
        neupId: string;
    };
    ipAddress?: string;
    geolocation?: string;
    reproSteps?: string;
    solution?: string;
    solvedBy?: string;
    problemLevel?: 'hot' | 'warm' | 'cold';
};

type ErrorInternal = SystemError & { rawTimestamp: Date };

export async function getSystemErrors({
  startAfter: startAfterDocId,
}: {
  startAfter?: string;
}): Promise<{
  errors: SystemError[];
  hasNextPage: boolean;
}> {
    try {
        const errorsCollection = collection(db, 'error');
        let constraints = [];
        constraints.push(orderBy('timestamp', 'desc'));

        if (startAfterDocId) {
            const startDoc = await getDoc(doc(db, 'error', startAfterDocId));
            constraints.push(startAfter(startDoc));
        }

        constraints.push(limit(PAGE_SIZE + 1));

        const q = query(errorsCollection, ...constraints);
        const errorsSnapshot = await getDocs(q);
        const pageDocs = errorsSnapshot.docs;

        const hasNextPage = pageDocs.length > PAGE_SIZE;
        if (hasNextPage) {
            pageDocs.pop();
        }

        const errors: SystemError[] = pageDocs.map(doc => {
            const data = doc.data();
            const timestamp = data.timestamp?.toDate() || new Date();
            return {
                id: doc.id,
                type: data.type,
                context: data.context,
                message: data.message.split('\n')[0], // Show first line only
                timestamp: timestamp.toLocaleString(),
                status: data.status || 'new'
            };
        });

        return {
            errors,
            hasNextPage,
        };

    } catch (error) {
        // Avoid an infinite loop if logging itself fails.
        console.error("CRITICAL: Could not fetch system errors.", error);
        return { errors: [], hasNextPage: false };
    }
}

export async function getErrorDetails(id: string): Promise<SystemErrorDetails | null> {
    try {
        const errorRef = doc(db, 'error', id);
        const errorDoc = await getDoc(errorRef);

        if (!errorDoc.exists()) {
            return null;
        }

        const data = errorDoc.data();
        let user;
        if (data.accountId) {
             const userProfile = await getUserProfile(data.accountId);
             user = {
                 name: userProfile?.displayName || 'Unknown User',
                 neupId: userProfile?.neupId || 'N/A'
             }
        }

        return {
            id: errorDoc.id,
            type: data.type,
            context: data.context,
            message: data.message.split('\n')[0],
            fullError: data.message,
            timestamp: data.timestamp?.toDate().toLocaleString() || 'N/A',
            status: data.status || 'new',
            user,
            ipAddress: data.ipAddress,
            geolocation: data.geolocation,
            reproSteps: data.reproSteps,
            solution: data.solution,
            solvedBy: data.solvedBy,
            problemLevel: data.problemLevel
        }

    } catch(e) {
        await logError('database', e, `getErrorDetails for id ${id}`);
        return null;
    }
}
