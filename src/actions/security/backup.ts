'use server';

import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { checkPermissions } from '@/lib/user';
import { createNotification } from '../notifications';

export type BackupCode = {
    code: string;
    used: boolean;
};

function generateSingleCode(): string {
    // Generates an 8-character alphanumeric code.
    return crypto.randomBytes(4).toString('hex').toUpperCase();
}

export async function getBackupCodes(): Promise<BackupCode[]> {
    const canView = await checkPermissions(['security.backup_codes.view']);
    if (!canView) return [];

    const accountId = await getPersonalAccountId();
    if (!accountId) return [];

    try {
        const codesRef = collection(db, 'auth_backup');
        const q = query(codesRef, where('accountId', '==', accountId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return [];
        }

        const doc = querySnapshot.docs[0];
        return doc.data().codes || [];

    } catch (error) {
        await logError('database', error, `getBackupCodes: ${accountId}`);
        return [];
    }
}

export async function generateBackupCodes(): Promise<BackupCode[]> {
    const canCreate = await checkPermissions(['security.backup_codes.create']);
    if (!canCreate) throw new Error("Permission denied.");

    const accountId = await getPersonalAccountId();
    if (!accountId) {
        throw new Error("User not authenticated.");
    }

    try {
        const newCodes: BackupCode[] = Array.from({ length: 10 }, () => ({
            code: generateSingleCode(),
            used: false,
        }));

        const codesRef = collection(db, 'auth_backup');
        const q = query(codesRef, where('accountId', '==', accountId));
        const querySnapshot = await getDocs(q);

        const batch = writeBatch(db);

        if (!querySnapshot.empty) {
            // Invalidate old codes by deleting the document.
            const oldDocRef = querySnapshot.docs[0].ref;
            batch.delete(oldDocRef);
        }

        // Create a new document with the new codes.
        const newDocRef = doc(codesRef);
        batch.set(newDocRef, {
            accountId: accountId,
            codes: newCodes,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();

        await logActivity(accountId, 'Generated new backup codes', 'Success');
        
        await createNotification({
            recipient_id: accountId,
            action: 'informative.security',
            message: 'New backup codes were generated for your account. Your old codes are now invalid.',
        });

        revalidatePath('/manage/security/backup');
        return newCodes;

    } catch (error) {
        await logError('database', error, `generateBackupCodes: ${accountId}`);
        throw new Error('Could not generate backup codes.');
    }
}
