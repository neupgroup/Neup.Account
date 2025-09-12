'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { phoneFormSchema } from '@/schemas/security';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { checkPermissions } from '@/lib/user';
import { createNotification } from '../notifications';

const CONTACT_TYPE = 'recoveryPhone';

function getDocRef(accountId: string) {
    // This custom ID format is to ensure one recovery phone per user.
    return doc(db, 'contact', `${CONTACT_TYPE}_${accountId}`);
}

export async function getRecoveryPhone(): Promise<string | null> {
    const canView = await checkPermissions(['security.recovery_phone.view']);
    if (!canView) return null;
    
    const accountId = await getPersonalAccountId();
    if (!accountId) return null;

    try {
        const contactRef = getDocRef(accountId);
        const contactDoc = await getDoc(contactRef);
        
        if (contactDoc.exists()) {
            return contactDoc.data().value || null;
        }

        return null;
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
    const contactRef = getDocRef(accountId);

    try {
        const currentDoc = await getDoc(contactRef);
        if (currentDoc.exists()) {
            return { success: false, error: "A recovery phone already exists. Please remove it first." };
        }

        await setDoc(contactRef, {
            account_id: accountId,
            contact_type: CONTACT_TYPE,
            value: phone,
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
        const contactRef = getDocRef(accountId);
        await deleteDoc(contactRef);
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
