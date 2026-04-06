'use server';

import prisma from '@/core/helpers/prisma';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {logError} from '@/core/helpers/logger';
import {checkPermissions} from '@/core/helpers/user';
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
    const canView = await checkPermissions(['root.site.social_accounts.read']);
    if (!canView) return [];

    try {
        const config = await prisma.systemConfig.findUnique({
            where: { id: SOCIALS_DOC_ID }
        });
        
        if (config && config.data && typeof config.data === 'object') {
            const data = config.data as any;
            if (data.links) return data.links as SocialLink[];
        }
        return [];
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
    const canAdd = await checkPermissions(['root.site.social_accounts.add']);
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

        await prisma.$transaction(async (tx) => {
            const config = await tx.systemConfig.findUnique({
                where: { id: SOCIALS_DOC_ID }
            });

            if (config) {
                const currentData = config.data as any;
                const currentLinks = (currentData.links || []) as SocialLink[];
                await tx.systemConfig.update({
                    where: { id: SOCIALS_DOC_ID },
                    data: {
                        data: {
                            ...currentData,
                            links: [...currentLinks, newLink]
                        }
                    }
                });
            } else {
                await tx.systemConfig.create({
                    data: {
                        id: SOCIALS_DOC_ID,
                        data: {
                            links: [newLink]
                        }
                    }
                });
            }
        });

        revalidatePath('/manage/site/socials');
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
    const canEdit = await checkPermissions(['root.site.social_accounts.edit']);
    if (!canEdit) return {success: false, error: 'Permission denied.'};

    try {
        await prisma.$transaction(async (tx) => {
            const config = await tx.systemConfig.findUnique({
                where: { id: SOCIALS_DOC_ID }
            });

            if (config) {
                const currentData = config.data as any;
                const links = (currentData.links || []) as SocialLink[];
                const updatedLinks = links.map(link =>
                    link.id === id ? {...link, isVisible: !link.isVisible} : link
                );
                await tx.systemConfig.update({
                    where: { id: SOCIALS_DOC_ID },
                    data: {
                        data: {
                            ...currentData,
                            links: updatedLinks
                        }
                    }
                });
            }
        });

        revalidatePath('/manage/site/socials');
        return {success: true};
    } catch (error) {
        await logError('database', error, `toggleSocialLinkVisibility: ${id}`);
        return {success: false, error: 'Failed to update visibility.'};
    }
}

export async function deleteSocialLink(id: string): Promise<{ success: boolean; error?: string }> {
    const canDelete = await checkPermissions(['root.site.social_accounts.delete']);
    if (!canDelete) return {success: false, error: 'Permission denied.'};

    try {
        await prisma.$transaction(async (tx) => {
            const config = await tx.systemConfig.findUnique({
                where: { id: SOCIALS_DOC_ID }
            });

            if (config) {
                const currentData = config.data as any;
                const links = (currentData.links || []) as SocialLink[];
                const updatedLinks = links.filter(link => link.id !== id);
                await tx.systemConfig.update({
                    where: { id: SOCIALS_DOC_ID },
                    data: {
                        data: {
                            ...currentData,
                            links: updatedLinks
                        }
                    }
                });
            }
        });

        revalidatePath('/manage/site/socials');
        return {success: true};
    } catch (error) {
        await logError('database', error, `deleteSocialLink: ${id}`);
        return {success: false, error: 'Failed to delete link.'};
    }
}