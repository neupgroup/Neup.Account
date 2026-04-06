'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { getActiveAccountId } from '@/core/helpers/auth-actions';
import { checkPermissions } from '@/core/helpers/user';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { changePasswordSchema } from '@/schemas/security';
import { createNotification } from '../notifications';
import prisma from '@/core/helpers/prisma';

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
        const passwordRecord = await prisma.password.findUnique({
            where: { accountId }
        });

        if (!passwordRecord) {
            return { success: false, error: "Authentication data not found." };
        }

        const isMatch = await bcrypt.compare(currentPassword, passwordRecord.hash);

        if (!isMatch) {
            await logActivity(accountId, 'Password Change Failed', 'Failed', undefined, undefined, geolocation);
            return { success: false, error: "The current password you entered is incorrect." };
        }

        const newHashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.password.update({
            where: { accountId },
            data: {
                hash: newHashedPassword,
                passwordLastChanged: new Date()
            }
        });
        
        await logActivity(accountId, 'Password Change', 'Success', undefined, undefined, geolocation);
        
        await createNotification({
            recipient_id: accountId,
            action: 'informative.security',
            message: 'Your password was changed successfully.',
        });

        return { success: true, message: "Password updated successfully." };

    } catch (error) {
        await logError('database', error, `changePassword: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
