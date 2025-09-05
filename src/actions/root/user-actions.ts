'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, writeBatch, query, where, getDocs, getDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { checkPermissions } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';
import { createNotification } from '../notifications';


// --- Administrative Actions ---
const sendWarningSchema = z.object({
    message: z.string().min(1, "Message cannot be empty"),
    reason: z.string().min(1, "Reason cannot be empty"),
    noticeType: z.enum(['general', 'success', 'warning', 'error']),
    persistence: z.enum(['dismissable', 'untildays', 'permanent']),
    days: z.number().optional(),
});

export async function sendWarning(userId: string, data: z.infer<typeof sendWarningSchema>): Promise<{success: boolean, error?: string}> {
    const canWarn = await checkPermissions(['root.account.send_warning']);
    if (!canWarn) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const validation = sendWarningSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data submitted." };
    }

    const { message, reason, noticeType, persistence, days } = validation.data;
    
    let expiresOn: Date | null = null;
    if (persistence === 'untildays' && days) {
        expiresOn = new Date();
        expiresOn.setDate(expiresOn.getDate() + days);
    }
    
    const actionTypeMap = {
        'general': 'information.sticky',
        'success': 'success.sticky',
        'warning': 'warning.sticky',
        'error': 'danger.sticky'
    };

    try {
        await createNotification({
            recipient_id: userId,
            action: actionTypeMap[noticeType],
            message,
            persistence,
            noticeType,
            reason,
            expiresOn,
            sender_id: adminId,
        });

        await logActivity(userId, `Admin sent warning: "${message}"`, 'Alert', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'sendWarning');
        return { success: false, error: 'Could not send warning.' };
    }
}

const blockServiceSchema = z.object({
    isPermanent: z.boolean(),
    durationInHours: z.number().optional(),
    reason: z.string().min(1, "Reason is required"),
    message: z.string().min(1, "Message is required"),
});

export async function blockServiceAccess(userId: string, data: z.infer<typeof blockServiceSchema>): Promise<{success: boolean, error?: string}> {
    const canBlock = await checkPermissions(['root.account.give_block_account']);
    if (!canBlock) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const validation = blockServiceSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid data submitted.' };
    }
    
    const { isPermanent, durationInHours, reason, message } = validation.data;
    
    try {
        const accountRef = doc(db, 'account', userId);
        
        let until = null;
        if (!isPermanent && durationInHours) {
            const date = new Date();
            date.setHours(date.getHours() + durationInHours);
            until = date;
        }

        const blockData = {
            status: true,
            reason,
            message,
            is_permanent: isPermanent,
            until: until,
        };

        await updateDoc(accountRef, { block: blockData });
        await logActivity(userId, `Service access blocked. Reason: ${reason}`, 'Alert', undefined, adminId);
        
        await createNotification({
            recipient_id: userId,
            action: 'danger.sticky',
            message: `Your account access has been blocked. Reason: ${reason}`,
            persistence: 'permanent',
            noticeType: 'error',
            sender_id: adminId,
        });

        return { success: true };
    } catch (error) {
        await logError('database', error, 'blockServiceAccess');
        return { success: false, error: 'Could not block service access.' };
    }
}


export async function unblockServiceAccess(userId: string): Promise<{success: boolean, error?: string}> {
    const canUnblock = await checkPermissions(['root.account.remove_block_account']);
    if (!canUnblock) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

     try {
        const accountRef = doc(db, 'account', userId);
        await updateDoc(accountRef, { block: null });
        await logActivity(userId, `Service access unblocked`, 'Success', undefined, adminId);
        
        await createNotification({
            recipient_id: userId,
            action: 'informative.unblock',
            message: 'Your account access has been restored.',
            sender_id: adminId,
        });

        return { success: true };
    } catch (error) {
        await logError('database', error, 'unblockServiceAccess');
        return { success: false, error: 'Could not unblock service access.' };
    }
}

export async function impersonateUser(userId: string, neupId: string): Promise<{success: boolean, error?: string}> {
    const canImpersonate = await checkPermissions(['root.account.impersonate']);
    if (!canImpersonate) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
        const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

        const expiresOn = new Date();
        expiresOn.setHours(expiresOn.getHours() + 1); // 1 hour impersonation
        const sessionKey = crypto.randomUUID();

        const newSessionDocRef = await addDoc(collection(db, 'session'), {
            accountId: userId,
            auth_session_key: sessionKey,
            ipAddress: ipAddress,
            userAgent: userAgent,
            isExpired: false,
            expiresOn: serverTimestamp(),
            lastLoggedIn: serverTimestamp(),
            loginType: 'Impersonation',
        });
        
        const cookieStore = await cookies();
        const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

        cookieStore.set('auth_account_id', userId, cookieOptions);
        cookieStore.set('auth_session_id', newSessionDocRef.id, cookieOptions);
        cookieStore.set('auth_session_key', sessionKey, cookieOptions);
        
        await logActivity(userId, `Admin impersonation started by ${adminId}`, 'Alert', undefined, adminId);
        
        await createNotification({
            recipient_id: userId,
            action: 'warning.sticky',
            message: `A root user has accessed your account using an impersonation session.`,
            persistence: 'permanent',
            noticeType: 'warning',
            sender_id: adminId,
        });

        return { success: true };
    } catch(error) {
        await logError('database', error, `impersonateUser: ${userId}`);
        return { success: false, error: 'Could not start impersonation session.' };
    }
}


export async function deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    const canDelete = await checkPermissions(['root.account.delete']);
    if (!canDelete) {
        return { success: false, error: 'Permission denied.' };
    }
    
    const adminId = await getPersonalAccountId();
    if (!adminId) {
        return { success: false, error: 'Administrator not authenticated.' };
    }

    try {
        const batch = writeBatch(db);

        // --- Documents to delete by direct reference ---
        batch.delete(doc(db, 'account', userId));
        batch.delete(doc(db, 'profile', userId));
        batch.delete(doc(db, 'auth_password', userId));
        // Delete TOTP if it exists
        const totpRef = doc(db, 'auth_totp', userId);
        const totpDoc = await getDoc(totpRef);
        if (totpDoc.exists()) {
            batch.delete(totpRef);
        }

        // --- Documents to find and delete via query ---
        const collectionsToQuery = [
            'neupid', 
            'contact', 
            'permit', // This handles permits given to the user
            'session', 
            'activity', 
            'notifications', 
            'kyc', 
            'requests',
            'recovery_contacts'
        ];
        
        for (const coll of collectionsToQuery) {
            const q = query(collection(db, coll), where(coll === 'neupid' ? 'for' : 'accountId', '==', userId));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => batch.delete(doc.ref));
        }

        // --- Also delete permits where this user is the target ---
        const targetPermitQuery = query(collection(db, 'permit'), where('target_id', '==', userId));
        const targetPermitSnapshot = await getDocs(targetPermitQuery);
        targetPermitSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        await logActivity(userId, `Account permanently deleted by admin ${adminId}`, 'Alert', undefined, adminId);
        
        return { success: true };

    } catch (error) {
        await logError('database', error, `deleteUserAccount for userId: ${userId}`);
        return { success: false, error: 'An unexpected error occurred during account deletion.' };
    }
}
