

'use server';

import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, writeBatch, query, where, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';
import { checkPermissions, getUserNeupIds } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';
import { createNotification } from '../notifications';
import { warningReasons, blockReasons } from '@/app/manage/root/accounts/[id]/forms';


// --- Administrative Actions ---

const sendWarningSchema = z.object({
    reasonKey: z.nativeEnum(warningReasons),
    source: z.string().optional(),
    remarks: z.string().min(1, "Remarks are required."),
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

    const { reasonKey, source, remarks, noticeType, persistence, days } = validation.data;
    
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
    
    const reasonText = warningReasons[reasonKey];
    const message = `Your account has received a warning for: <strong>${reasonText}</strong>. Please review our community guidelines.`;

    try {
        await createNotification({
            recipient_id: userId,
            action: actionTypeMap[noticeType],
            message,
            persistence,
            noticeType,
            reason: remarks,
            expiresOn,
            sender_id: adminId,
        });

        await logActivity(userId, `Admin sent warning for ${reasonText}`, 'Alert', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'sendWarning');
        return { success: false, error: 'Could not send warning.' };
    }
}

const blockServiceSchema = z.object({
    isPermanent: z.boolean(),
    durationInHours: z.number().optional(),
    reasonKey: z.nativeEnum(blockReasons),
    source: z.string().optional(),
    remarks: z.string().min(1, "Remarks are required"),
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
    
    const { isPermanent, durationInHours, reasonKey, source, remarks } = validation.data;
    const { reason, message } = blockReasons[reasonKey];
    
    try {
        const accountRef = doc(db, 'account', userId);
        const batch = writeBatch(db);
        
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
            source: source || null,
            remarks: remarks,
            blockedBy: adminId,
            blockedOn: serverTimestamp()
        };

        batch.update(accountRef, { block: blockData, status: 'blocked' });

        const statusLogRef = doc(collection(db, 'account_status'));
        batch.set(statusLogRef, {
            account_id: userId,
            status: 'blocked',
            remarks: `Admin blocked access. Reason: ${reason}. ${remarks}`,
            from_date: serverTimestamp(),
            more_info: `Request by admin: ${adminId}.`
        });
        
        await batch.commit();

        await logActivity(userId, `Service access blocked. Reason: ${reason}`, 'Alert', undefined, adminId);
        
        await createNotification({
            recipient_id: userId,
            action: 'danger.sticky',
            message,
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
        const batch = writeBatch(db);
        
        batch.update(accountRef, { block: null, status: 'active' });

        const statusLogRef = doc(collection(db, 'account_status'));
        batch.set(statusLogRef, {
            account_id: userId,
            status: 'active',
            remarks: 'Service access restored by admin.',
            from_date: serverTimestamp(),
            more_info: `Request by admin: ${adminId}.`
        });
        
        await batch.commit();

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

export async function setProStatus(accountId: string, isPro: boolean, reason: string): Promise<{ success: boolean; error?: string }> {
    const canModify = await checkPermissions(['root.account.edit_pro_status']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const accountRef = doc(db, 'account', accountId);
        await updateDoc(accountRef, { pro: isPro });

        const action = isPro ? 'Activated Neup.Pro' : 'Deactivated Neup.Pro';
        await logActivity(accountId, `${action} by admin. Reason: ${reason}`, 'Success', undefined, adminId);
        
        await createNotification({
            recipient_id: accountId,
            action: isPro ? 'success.sticky' : 'warning.sticky',
            message: `Your Neup.Pro status has been ${isPro ? 'activated' : 'deactivated'} by an administrator.`,
            persistence: 'dismissable',
            noticeType: isPro ? 'success' : 'warning',
            sender_id: adminId,
        });
        
        return { success: true };
    } catch (e) {
        await logError('database', e, `setProStatus for account ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function addNeupId(accountId: string, neupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const lowerCaseNeupId = neupId.toLowerCase();

    try {
        const neupidRef = doc(db, 'neupid', lowerCaseNeupId);
        const neupidDoc = await getDoc(neupidRef);
        if (neupidDoc.exists()) {
            return { success: false, error: 'This NeupID is already taken.' };
        }

        await setDoc(neupidRef, {
            for: accountId,
            is_primary: false,
        });

        await logActivity(accountId, `NeupID added by admin: ${lowerCaseNeupId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `addNeupId for account ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function removeNeupId(neupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const neupidRef = doc(db, 'neupid', neupId);
        const neupidDoc = await getDoc(neupidRef);
        if (!neupidDoc.exists()) {
            return { success: false, error: 'NeupID not found.' };
        }
        
        if (neupidDoc.data().is_primary) {
            return { success: false, error: 'Cannot remove a primary NeupID. Set another as primary first.' };
        }
        
        const accountId = neupidDoc.data().for;
        await deleteDoc(neupidRef);

        await logActivity(accountId, `NeupID removed by admin: ${neupId}`, 'Success', undefined, adminId);
         revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `removeNeupId: ${neupId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}

export async function setPrimaryNeupId(accountId: string, newPrimaryNeupId: string): Promise<{ success: boolean; error?: string; }> {
    const canModify = await checkPermissions(['root.account.edit_neupid']);
    if (!canModify) return { success: false, error: 'Permission denied.' };
    
    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        const existingNeupIds = await getUserNeupIds(accountId);
        if (!existingNeupIds.includes(newPrimaryNeupId)) {
            return { success: false, error: 'This NeupID does not belong to the user.' };
        }
        
        const batch = writeBatch(db);
        
        // Unset old primary
        existingNeupIds.forEach(id => {
            const docRef = doc(db, 'neupid', id);
            batch.update(docRef, { is_primary: false });
        });
        
        // Set new primary
        const newPrimaryRef = doc(db, 'neupid', newPrimaryNeupId);
        batch.update(newPrimaryRef, { is_primary: true });

        await batch.commit();

        await logActivity(accountId, `Primary NeupID set to: ${newPrimaryNeupId}`, 'Success', undefined, adminId);
        revalidatePath(`/manage/root/accounts/${accountId}/profile/neupid`);
        return { success: true };
    } catch (e) {
        await logError('database', e, `setPrimaryNeupId for account ${accountId}`);
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
