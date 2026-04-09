"use server";

import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { checkPermissions } from '@/core/helpers/user';
import { logActivity } from '@/core/helpers/log-actions';
import { logError } from '@/core/helpers/logger';
import { createNotification } from '@/services/notifications';

/**
 * Public backup code shape.
 */
export type BackupCode = {
	code: string;
	used: boolean;
};



/**
 * Generic backup operation result.
 */
export type BackupCodeActionResult = {
	success: boolean;
	error?: string;
	code?: string;
	codes?: BackupCode[];
};



/**
 * Input for verifying a backup code.
 */
export type VerifyBackupCodeInput = {
	accountId: string;
	code: string;
};



/**
 * Input for expiring a backup code.
 */
export type ExpireBackupCodeInput = {
	accountId: string;
	code: string;
};



function generateSingleCode(): string {
	return crypto.randomBytes(4).toString('hex').toUpperCase();
}



/**
 * Verifies a backup code and marks it used when valid.
 */
export async function verifyBackupCode(input: VerifyBackupCodeInput): Promise<BackupCodeActionResult> {
	const accountId = input.accountId?.trim();
	const code = input.code?.trim().toUpperCase();

	if (!accountId || !code) {
		return { success: false, error: 'Missing accountId or code.' };
	}

	try {
		const existing = await prisma.backupCode.findFirst({
			where: {
				accountId,
				code,
				used: false,
			},
			select: { id: true },
		});

		if (!existing) {
			return { success: false, error: 'Invalid backup code.' };
		}

		await prisma.backupCode.update({
			where: { id: existing.id },
			data: { used: true },
		});

		return { success: true };
	} catch (error) {
		await logError('database', error, `verifyBackupCode:${accountId}`);
		return { success: false, error: 'Could not verify backup code.' };
	}
}



/**
 * Generates and stores a new set of backup codes for the active account.
 */
export async function generateBackupCode(): Promise<BackupCodeActionResult> {
	const canCreate = await checkPermissions(['security.backup_codes.create']);
	if (!canCreate) return { success: false, error: 'Permission denied.' };

	const accountId = await getPersonalAccountId();
	if (!accountId) return { success: false, error: 'User not authenticated.' };

	try {
		const newCodes: BackupCode[] = Array.from({ length: 10 }, () => ({
			code: generateSingleCode(),
			used: false,
		}));

		await prisma.$transaction([
			prisma.backupCode.deleteMany({ where: { accountId } }),
			prisma.backupCode.createMany({
				data: newCodes.map((item) => ({
					accountId,
					code: item.code,
					used: false,
				})),
			}),
		]);

		await logActivity(accountId, 'Generated new backup codes', 'Success');
		await createNotification({
			recipient_id: accountId,
			action: 'informative.security',
			message: 'New backup codes were generated for your account. Your old codes are now invalid.',
		});

		return { success: true, codes: newCodes };
	} catch (error) {
		await logError('database', error, `generateBackupCode:${accountId}`);
		return { success: false, error: 'Could not generate backup codes.' };
	}
}



/**
 * Returns backup codes for the active account.
 */
export async function getBackupCode(): Promise<BackupCodeActionResult> {
	const canView = await checkPermissions(['security.backup_codes.view']);
	if (!canView) return { success: false, error: 'Permission denied.' };

	const accountId = await getPersonalAccountId();
	if (!accountId) return { success: false, error: 'User not authenticated.' };

	try {
		const codes = await prisma.backupCode.findMany({
			where: { accountId },
			orderBy: { createdAt: 'desc' },
			select: {
				code: true,
				used: true,
			},
		});

		return {
			success: true,
			codes: codes.map((item) => ({ code: item.code, used: item.used })),
		};
	} catch (error) {
		await logError('database', error, `getBackupCode:${accountId}`);
		return { success: false, error: 'Could not fetch backup codes.' };
	}
}



/**
 * Expires a backup code by marking it as used.
 */
export async function expireBackupCode(input: ExpireBackupCodeInput): Promise<BackupCodeActionResult> {
	const accountId = input.accountId?.trim();
	const code = input.code?.trim().toUpperCase();

	if (!accountId || !code) {
		return { success: false, error: 'Missing accountId or code.' };
	}

	try {
		const existing = await prisma.backupCode.findFirst({
			where: {
				accountId,
				code,
				used: false,
			},
			select: { id: true },
		});

		if (!existing) {
			return { success: false, error: 'Backup code not found or already expired.' };
		}

		await prisma.backupCode.update({
			where: { id: existing.id },
			data: { used: true },
		});

		return { success: true, code };
	} catch (error) {
		await logError('database', error, `expireBackupCode:${accountId}`);
		return { success: false, error: 'Could not expire backup code.' };
	}
}