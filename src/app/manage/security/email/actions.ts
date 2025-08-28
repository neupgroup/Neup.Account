'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { emailFormSchema } from './schema';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { checkPermissions } from '@/lib/user';

const CONTACT_TYPE = 'recoveryEmail';

function getDocRef(accountId: string) {
    return doc(db, 'contact', `${CONTACT_TYPE}_${accountId}`);
}

export async function getRecoveryEmail(): Promise<string | null> {
    const canView = await checkPermissions(['security.recovery_email.view']);
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
        await logError('database', error, `getRecoveryEmail: ${accountId}`);
        return null;
    }
}

export async function addRecoveryEmail(data: z.infer<typeof emailFormSchema>): Promise<{ success: boolean; error?: string; }> {
    const canAdd = await checkPermissions(['security.recovery_email.add']);
    if (!canAdd) return { success: false, error: "Permission denied." };

    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = emailFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.email?.[0] };
    }
    
    const { email } = validation.data;
    const contactRef = getDocRef(accountId);

    try {
        const currentDoc = await getDoc(contactRef);
        if (currentDoc.exists()) {
            return { success: false, error: "A recovery email already exists. Please remove it first." };
        }

        await setDoc(contactRef, {
            account_id: accountId,
            contact_type: CONTACT_TYPE,
            value: email,
        });
        await logActivity(accountId, 'Added Recovery Email', 'Success');
        revalidatePath('/manage/security/email');
        return { success: true };

    } catch (error) {
        await logError('database', error, `addRecoveryEmail: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function removeRecoveryEmail(): Promise<{ success: boolean; error?: string; }> {
    const canRemove = await checkPermissions(['security.recovery_email.remove']);
    if (!canRemove) return { success: false, error: "Permission denied." };
    
    const accountId = await getPersonalAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    try {
        const contactRef = getDocRef(accountId);
        await deleteDoc(contactRef);
        await logActivity(accountId, 'Removed Recovery Email', 'Success');
        revalidatePath('/manage/security/email');
        return { success: true };
    } catch (error) {
        await logError('database', error, `removeRecoveryEmail: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
