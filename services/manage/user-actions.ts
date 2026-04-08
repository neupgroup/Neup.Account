'use server';

import prisma from '@/core/helpers/prisma';
import { Prisma } from '../../prisma/generated/client/client';
import { logError } from '@/core/helpers/logger';
import { checkPermissions, getUserNeupIds } from '@/core/helpers/user';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logActivity } from '@/core/helpers/log-actions';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { z } from 'zod';
import { createNotification } from '../notifications';
import { warningReasons } from '@/app/(manage)/manage/[id]/forms';


// --- Administrative Actions ---

const sendWarningSchema = z.object({
    reasonKey: z.nativeEnum(warningReasons),
    source: z.string().optional(),
    remarks: z.string().min(1, "Remarks are required."),
    noticeType: z.enum(['general', 'success', 'warning', 'error']),
    persistence: z.enum(['dismissable', 'untildays', 'permanent']),
    days: z.number().optional(),
});

export async function sendWarning(userId: string, data: z.infer<typeof sendWarningSchema>): Promise<{ success: boolean, error?: string }> {
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

    const reasonText = warningReasons[reasonKey as keyof typeof warningReasons];
    const message = `Your account has received a warning for: <strong>${reasonText}</strong>. Please review our community guidelines.`;

    try {
        await createNotification({
            recipient_id: userId,
            action: actionTypeMap[noticeType],
            message,
            persistence,
            noticeType,
            reason: remarks,
            expiresOn: expiresOn || undefined,
            sender_id: adminId,
        });

        await logActivity(userId, `Admin sent warning for ${reasonText}`, 'Alert', undefined, adminId);
        return { success: true };
    } catch (error) {
        await logError('database', error, 'sendWarning');
        return { success: false, error: 'Could not send warning.' };
    }
}

const blockReasons = {
    security_risk: { reason: "Compromised Account / Security Risk", message: "Your account has been temporarily blocked due to a potential security risk." },
    payment_issue: {
        reason: "Payment or Billing Issue",
        message: "Your account access has been blocked due to a payment or billing issue. Please contact support."
    },
    tos_repeated: {
        reason: "Repeated Terms of Service Violations",
        message: "Your account has been blocked due to repeated violations of our Terms of Service."
    },
    illegal_activity: {
        reason: "Illegal Activity",
        message: "Your account has been permanently blocked due to illegal activity."
    },
    other: {
        reason: "Other Policy Violation",
        message: "Your account has been blocked for violating our policies. Please contact support for more information."
    }
} as const;

const blockServiceSchema = z.object({
    reasonKey: z.enum(['security_risk', 'payment_issue', 'tos_repeated', 'illegal_activity', 'other'] as const),
    isPermanent: z.boolean(),
    durationInHours: z.number().optional(),
    source: z.string().optional(),
    remarks: z.string().min(1, "Remarks are required"),
});

export async function blockServiceAccess(userId: string, data: z.infer<typeof blockServiceSchema>): Promise<{ success: boolean, error?: string }> {
    const canBlock = await checkPermissions(['root.account.give_block_account']);
    if (!canBlock) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    const validation = blockServiceSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid data submitted.' };
    }

    const { isPermanent, durationInHours, reasonKey, source, remarks } = validation.data;
    const { reason, message } = blockReasons[reasonKey as keyof typeof blockReasons];

    try {
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
            until: until ? until.toISOString() : null,
            source: source || null,
            remarks: remarks,
            blockedBy: adminId,
            blockedOn: new Date().toISOString()
        };

        await prisma.$transaction([
            prisma.account.update({
                where: { id: userId },
                data: { 
                    block: blockData, 
                    accountStatus: 'blocked' 
                }
            }),
            prisma.accountStatusLog.create({
                data: {
                    accountId: userId,
                    status: 'blocked',
                    remarks: `Admin blocked access. Reason: ${reason}. ${remarks}`,
                    fromDate: new Date(),
                    moreInfo: `Request by admin: ${adminId}.`
                }
            })
        ]);

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


export async function unblockServiceAccess(userId: string): Promise<{ success: boolean, error?: string }> {
    const canUnblock = await checkPermissions(['root.account.remove_block_account']);
    if (!canUnblock) return { success: false, error: 'Permission denied.' };

    const adminId = await getPersonalAccountId();
    if (!adminId) return { success: false, error: 'Administrator not authenticated.' };

    try {
        await prisma.$transaction([
            prisma.account.update({
                 where: { id: userId },
                 data: { 
                     block: Prisma.DbNull, 
                     accountStatus: 'active' 
                 }
             }),
            prisma.accountStatusLog.create({
                data: {
                    accountId: userId,
                    status: 'active',
                    remarks: 'Service access restored by admin.',
                    fromDate: new Date(),
                    moreInfo: `Request by admin: ${adminId}.`
                }
            })
        ]);

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

export async function impersonateUser(userId: string, neupId: string): Promise<{ success: boolean, error?: string }> {
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

        const newSession = await prisma.session.create({
            data: {
                accountId: userId,
                authSessionKey: sessionKey,
                ipAddress: ipAddress,
                userAgent: userAgent,
                isExpired: false,
                expiresOn: expiresOn,
                lastLoggedIn: new Date(),
                loginType: 'Impersonation',
            }
        });

        const cookieStore = await cookies();
        const cookieOptions = { path: '/', expires: expiresOn, sameSite: 'lax' as const, secure: true, httpOnly: true };

        cookieStore.set('auth_aid', userId, cookieOptions);
        cookieStore.set('auth_sid', newSession.id, cookieOptions);
        cookieStore.set('auth_skey', sessionKey, cookieOptions);
        cookieStore.delete('auth_jwt');

        await logActivity(userId, `Admin impersonation started by ${adminId}`, 'Alert', undefined, adminId);

        await createNotification({
            recipient_id: userId,
            action: 'warning.sticky',
            message: `Your account was inspected by a superuser.`,
            persistence: 'permanent',
            noticeType: 'warning',
            sender_id: adminId,
        });

        return { success: true };
    } catch (error) {
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
        // In Prisma, we can use delete with cascade if relations are set up correctly.
        // If not, we need to delete related data manually in a transaction.
        await prisma.$transaction([
            prisma.neupId.deleteMany({ where: { accountId: userId } }),
            prisma.contact.deleteMany({ where: { accountId: userId } }),
            prisma.permit.deleteMany({ 
                where: { 
                    OR: [
                        { accountId: userId },
                        { targetAccountId: userId }
                    ]
                } 
            }),
            prisma.session.deleteMany({ where: { accountId: userId } }),
            prisma.activityLog.deleteMany({ 
                where: { 
                    OR: [
                        { targetAccountId: userId },
                        { actorAccountId: userId }
                    ]
                } 
            }),
            prisma.notification.deleteMany({ where: { accountId: userId } }),
            prisma.kycRequest.deleteMany({ where: { accountId: userId } }),
            prisma.backupCode.deleteMany({ where: { accountId: userId } }),
            prisma.verification.deleteMany({ where: { accountId: userId } }),
            prisma.userDocument.deleteMany({ where: { accountId: userId } }),
            prisma.userContent.deleteMany({ where: { forAccountId: userId } }),
            prisma.password.deleteMany({ where: { accountId: userId } }),
            prisma.totp.deleteMany({ where: { accountId: userId } }),
            prisma.accountStatusLog.deleteMany({ where: { accountId: userId } }),
            prisma.account.delete({ where: { id: userId } }),
        ]);

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
        await prisma.account.update({
            where: { id: accountId },
            data: { pro: isPro }
        });

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