'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { getActiveAccountId } from '@/lib/auth-actions';
import { checkPermissions } from '@/lib/user';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { changePasswordSchema } from '@/schemas/security';

export async function changePassword(data: z.infer<typeof changePasswordSchema>, geolocation?: string) {
    const hasPermission = await checkPermissions(['security.pass.modify']);
    if (!hasPermission) {
        return { success: false, error: "You don't have permission to change the password." };
    }

    const accountId = await getActiveAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = changePasswordSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: "Invalid data provided.", details: validation.error.flatten() };
    }

    const { currentPassword, newPassword } = validation.data;

    try {
        const authRef = doc(db, 'auth_password', accountId);
        const authDoc = await getDoc(authRef);

        if (!authDoc.exists()) {
            return { success: false, error: "Authentication data not found." };
        }

        const isMatch = await bcrypt.compare(currentPassword, authDoc.data().pass);

        if (!isMatch) {
            await logActivity(accountId, 'Password Change Failed', 'Failed', undefined, undefined, geolocation);
            return { success: false, error: "The current password you entered is incorrect." };
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        await updateDoc(authRef, {
            pass: newHashedPassword,
            passwordLastChanged: serverTimestamp()
        });
        
        await logActivity(accountId, 'Password Change', 'Success', undefined, undefined, geolocation);

        return { success: true, message: "Password updated successfully." };

    } catch (error) {
        await logError('database', error, `changePassword: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
