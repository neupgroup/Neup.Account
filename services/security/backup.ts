'use server';

import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { checkPermissions } from '@/core/helpers/user';
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
        const codes = await prisma.backupCode.findMany({
            where: { accountId },
            orderBy: { createdAt: 'desc' }
        });

        return codes.map(c => ({
            code: c.code,
            used: c.used
        }));

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

        await prisma.$transaction([
            // Invalidate old codes by deleting them.
            prisma.backupCode.deleteMany({
                where: { accountId }
            }),
            // Create new codes.
            prisma.backupCode.createMany({
                data: newCodes.map(c => ({
                    accountId,
                    code: c.code,
                    used: false
                }))
            })
        ]);

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
