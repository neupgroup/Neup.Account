'use server';

import prisma from '@/core/helpers/prisma';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { phoneFormSchema } from '@/services/security/schema';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { checkPermissions } from '@/core/helpers/user';
import { createNotification } from '../notifications';

const CONTACT_TYPE = 'recoveryPhone';

export async function getRecoveryPhone(): Promise<string | null> {
    const canView = await checkPermissions(['security.recovery_phone.view']);
    if (!canView) return null;
    
    const accountId = await getPersonalAccountId();
    if (!accountId) return null;

    try {
        const contact = await prisma.contact.findFirst({
            where: {
                accountId,
                contactType: CONTACT_TYPE
            }
        });
        
        return contact ? contact.value : null;
    } catch (error) {
        await logError('database', error, `getRecoveryPhone: ${accountId}`);
        return null;
    }
}

export async function addRecoveryPhone(data: z.infer<typeof phoneFormSchema>): Promise<{ success: boolean; error?: string; }> {
    const canAdd = await checkPermissions(['security.recovery_phone.add']);
    if (!canAdd) return { success: false, error: "Permission denied." };
    
    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = phoneFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.phone?.[0] };
    }
    
    const { phone } = validation.data;

    try {
        const currentContact = await prisma.contact.findFirst({
            where: {
                accountId,
                contactType: CONTACT_TYPE
            }
        });

        if (currentContact) {
            return { success: false, error: "A recovery phone already exists. Please remove it first." };
        }

        await prisma.contact.create({
            data: {
                accountId,
                contactType: CONTACT_TYPE,
                value: phone,
            }
        });

        await logActivity(accountId, 'Added Recovery Phone', 'Success');
        
        await createNotification({
            recipient_id: accountId,
            action: 'informative.security',
            message: `A new recovery phone (${phone}) was added to your account.`,
        });

        revalidatePath('/manage/security/phone');
        return { success: true };

    } catch (error) {
        await logError('database', error, `addRecoveryPhone: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function removeRecoveryPhone(): Promise<{ success: boolean; error?: string; }> {
    const canRemove = await checkPermissions(['security.recovery_phone.remove']);
    if (!canRemove) return { success: false, error: "Permission denied." };

    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        await prisma.contact.deleteMany({
            where: {
                accountId,
                contactType: CONTACT_TYPE
            }
        });

        await logActivity(accountId, 'Removed Recovery Phone', 'Success');
        
        await createNotification({
            recipient_id: accountId,
            action: 'informative.security',
            message: `Your recovery phone number has been removed.`,
        });

        revalidatePath('/manage/security/phone');
        return { success: true };
    } catch (error) {
        await logError('database', error, `removeRecoveryPhone: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
