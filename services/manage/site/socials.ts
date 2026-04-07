'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {logError} from '@/core/helpers/logger';
import {checkPermissions} from '@/core/helpers/user';
import crypto from 'crypto';
import type {SocialLink} from '@/types';
import { APP_PROFILE_KEYS, readAppProfileData, writeAppProfileData } from '@/services/manage/site/app-profile';


// Database schema for social links.
const formSchema = z.object({
    type: z.enum(['instagram', 'linkedin', 'twitter', 'facebook', 'whatsapp', 'other']),
    url: z.string().url("Please enter a valid URL."),
});


// Fetch all social media links.
export async function getSocialLinks(): Promise<SocialLink[]> {
    const canView =
        (await checkPermissions(['root.site.social_accounts.read'])) ||
        (await checkPermissions(['root.payment_config.view']));
    if (!canView) return [];

    try {
        const data = await readAppProfileData<{ links?: SocialLink[] }>(
            APP_PROFILE_KEYS.socials,
            {},
        );

        return data.links || [];
    } catch (error) {
        await logError('database', error, 'getSocialLinks');
        return [];
    }
}

export async function addSocialLink(formData: FormData): Promise<{
    success: boolean;
    error?: string;
    newLink?: SocialLink
}> {
    const canAdd =
        (await checkPermissions(['root.site.social_accounts.add'])) ||
        (await checkPermissions(['root.payment_config.view']));
    if (!canAdd) return {success: false, error: 'Permission denied.'};
    
    const rawData = Object.fromEntries(formData.entries());
    const validation = formSchema.safeParse(rawData);
    
    if (!validation.success) {
        return {
            success: false,
            error: validation.error.flatten().fieldErrors.url?.[0] || validation.error.flatten().fieldErrors.type?.[0]
        };
    }
    
    const {type, url} = validation.data;
    
    try {
        const newLink: SocialLink = {
            id: crypto.randomUUID(),
            type,
            url,
            isVisible: true
        };

        const currentData = await readAppProfileData<{ links?: SocialLink[] }>(
            APP_PROFILE_KEYS.socials,
            {},
        );
        const currentLinks = currentData.links || [];
        const success = await writeAppProfileData(APP_PROFILE_KEYS.socials, {
            ...currentData,
            links: [...currentLinks, newLink],
        });
        if (!success) {
            return {success: false, error: 'Failed to add new link.'};
        }

        revalidatePath('/manage/site/socials');
        revalidatePath('/manage/config/socials');
        return {success: true, newLink};
    } catch (error: any) {
        await logError('database', error, 'addSocialLink');
        return {success: false, error: 'Failed to add new link.'};
    }
}

export async function toggleSocialLinkVisibility(id: string, isVisible: boolean): Promise<{
    success: boolean;
    error?: string
}> {
    const canEdit =
        (await checkPermissions(['root.site.social_accounts.edit'])) ||
        (await checkPermissions(['root.payment_config.view']));
    if (!canEdit) return {success: false, error: 'Permission denied.'};

    try {
        const currentData = await readAppProfileData<{ links?: SocialLink[] }>(
            APP_PROFILE_KEYS.socials,
            {},
        );
        const links = currentData.links || [];
        const updatedLinks = links.map(link =>
            link.id === id ? {...link, isVisible: !link.isVisible} : link
        );
        const success = await writeAppProfileData(APP_PROFILE_KEYS.socials, {
            ...currentData,
            links: updatedLinks,
        });
        if (!success) {
            return {success: false, error: 'Failed to update visibility.'};
        }

        revalidatePath('/manage/site/socials');
        revalidatePath('/manage/config/socials');
        return {success: true};
    } catch (error) {
        await logError('database', error, `toggleSocialLinkVisibility: ${id}`);
        return {success: false, error: 'Failed to update visibility.'};
    }
}

export async function deleteSocialLink(id: string): Promise<{ success: boolean; error?: string }> {
    const canDelete =
        (await checkPermissions(['root.site.social_accounts.delete'])) ||
        (await checkPermissions(['root.payment_config.view']));
    if (!canDelete) return {success: false, error: 'Permission denied.'};

    try {
        const currentData = await readAppProfileData<{ links?: SocialLink[] }>(
            APP_PROFILE_KEYS.socials,
            {},
        );
        const links = currentData.links || [];
        const updatedLinks = links.filter(link => link.id !== id);
        const success = await writeAppProfileData(APP_PROFILE_KEYS.socials, {
            ...currentData,
            links: updatedLinks,
        });
        if (!success) {
            return {success: false, error: 'Failed to delete link.'};
        }

        revalidatePath('/manage/site/socials');
        revalidatePath('/manage/config/socials');
        return {success: true};
    } catch (error) {
        await logError('database', error, `deleteSocialLink: ${id}`);
        return {success: false, error: 'Failed to delete link.'};
    }
}