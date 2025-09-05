'use server';

import {db} from '@/lib/firebase';
import {doc, updateDoc, setDoc, getDoc, arrayRemove, arrayUnion} from 'firebase/firestore';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {logError} from '@/lib/logger';
import {checkPermissions} from '@/lib/user';
import crypto from 'crypto';
import type {SocialLink} from '@/types';


// Database schema for social links.
const formSchema = z.object({
    type: z.enum(['instagram', 'linkedin', 'twitter', 'facebook', 'whatsapp', 'other']),
    url: z.string().url("Please enter a valid URL."),
});


// Document ID for storing social links.
const SOCIALS_DOC_ID = 'company_socials';


// Fetch all social media links.
export async function getSocialLinks(): Promise<SocialLink[]> {
    // Check if the user has permission to view social links.
    const canView = await checkPermissions(['root.site.social_accounts.read']);
    if (!canView) return [];

    // Fetch the social links from the database.
    try {
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);
        // Return the links if they exist, otherwise return an empty array.
        if (docSnap.exists() && docSnap.data().links) return docSnap.data().links as SocialLink[];
        else return [];
    } catch (error) {
        await logError('database', error, 'getSocialLinks');
        return [];
    }
}


// Add a new social media link.
export async function addSocialLink(formData: FormData): Promise<{
    success: boolean;
    error?: string;
    newLink?: SocialLink
}> {
    const canAdd = await checkPermissions(['root.site.social_accounts.add']);
    if (!canAdd) return {success: false, error: 'Permission denied.'};
    // Parse and validate the form data.
    const rawData = Object.fromEntries(formData.entries());
    const validation = formSchema.safeParse(rawData);
    // If validation fails, return the first error message.
    if (!validation.success) {
        return {
            success: false,
            error: validation.error.flatten().fieldErrors.url?.[0] || validation.error.flatten().fieldErrors.type?.[0]
        };
    }
    // Destructure the validated data.
    const {type, url} = validation.data;
    // Create a new social link object.
    try {
        const newLink: SocialLink = {
            id: crypto.randomUUID(),
            type,
            url,
            isVisible: true
        };
        // Try to update the existing document with the new link.
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        await updateDoc(docRef, {links: arrayUnion(newLink)});
        // If the document doesn't exist, this will throw an error which we catch below.
        revalidatePath('/manage/root/site/socials');
        return {success: true, newLink};
    } catch (error: any) {
        if (error.code === 'not-found' || (error.message && error.message.includes("No document to update"))) {
            try {
                const newLink: SocialLink = {id: crypto.randomUUID(), type, url, isVisible: true};
                await setDoc(doc(db, 'system', SOCIALS_DOC_ID), {links: [newLink]});
                revalidatePath('/manage/root/site/socials');
                return {success: true, newLink};
            } catch (initError) {
                await logError('database', initError, 'addSocialLink:init');
                return {success: false, error: 'Failed to add new link.'};
            }
        }
        await logError('database', error, 'addSocialLink');
        return {success: false, error: 'Failed to add new link.'};
    }
}


// Change visibility of social media links.
export async function toggleSocialLinkVisibility(id: string, isVisible: boolean): Promise<{
    success: boolean;
    error?: string
}> {
    const canEdit = await checkPermissions(['root.site.social_accounts.edit']);
    if (!canEdit) return {success: false, error: 'Permission denied.'};

    try {
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const links = (docSnap.data().links || []) as SocialLink[];
            const updatedLinks = links.map(link =>
                link.id === id ? {...link, isVisible: !link.isVisible} : link
            );
            await updateDoc(docRef, {links: updatedLinks});
            revalidatePath('/manage/root/site/socials');
            return {success: true};
        }
        return {success: false, error: 'Social links document not found.'};

    } catch (error) {
        await logError('database', error, `toggleSocialLinkVisibility: ${id}`);
        return {success: false, error: 'Failed to update visibility.'};
    }
}

// Delete social media links.
export async function deleteSocialLink(id: string): Promise<{ success: boolean; error?: string }> {
    const canDelete = await checkPermissions(['root.site.social_accounts.delete']);
    if (!canDelete) return {success: false, error: 'Permission denied.'};

    try {
        const docRef = doc(db, 'system', SOCIALS_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const links = (docSnap.data().links || []) as SocialLink[];
            const linkToDelete = links.find(link => link.id === id);

            if (linkToDelete) {
                await updateDoc(docRef, {links: arrayRemove(linkToDelete)});
                revalidatePath('/manage/root/site/socials');
                return {success: true};
            }
        }
        return {success: false, error: 'Link not found.'};
    } catch (error) {
        await logError('database', error, `deleteSocialLink: ${id}`);
        return {success: false, error: 'Failed to delete link.'};
    }
}