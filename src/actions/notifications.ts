'use server';

import prisma from '@/lib/prisma';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { checkPermissions } from '@/lib/user';

export type Notification = {
    id: string;
    isRead: boolean;
    createdAt: string;
    deletableOn?: string | null;
    action: string;
    message?: string;
    persistence?: 'dismissable' | 'untildays' | 'permanent';
    noticeType?: 'general' | 'success' | 'warning' | 'error';
    requestId?: string;
    senderId?: string;
    senderName?: string;
    senderNeupId?: string;
};

export type AllNotifications = {
    sticky: Notification[];
    requests: Notification[];
    other: Notification[];
};

export type NotificationCreate = {
    recipient_id: string;
    action: string;
    message?: string;
    persistence?: string;
    noticeType?: string;
    reason?: string;
    expiresOn?: Date;
    sender_id?: string;
};

export async function makeNotification(data: NotificationCreate) {
    try {
        const now = new Date();
        let deletable_on: Date | null = data.expiresOn || null;
        
        const action = data.action;

        if (!deletable_on) {
            if (action === 'informative.login') {
                deletable_on = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            } else if (action.startsWith('informative.security') || action.startsWith('security.')) {
                deletable_on = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            } else if (action.endsWith('_invitation')) {
                deletable_on = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
            }
        }

        await prisma.notification.create({
            data: {
                accountId: data.recipient_id,
                action: data.action,
                message: data.message,
                persistence: data.persistence,
                type: data.noticeType || 'info',
                deletableOn: deletable_on,
                createdAt: now,
            },
        });
    } catch (e) {
        await logError('database', e, `makeNotification for ${data.recipient_id}`);
    }
}

// Backward compatibility for existing call sites.
export async function createNotification(data: NotificationCreate) {
    return makeNotification(data);
}


export async function getNotifications(): Promise<AllNotifications> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return { sticky: [], requests: [], other: [] };

    const notifications = await prisma.notification.findMany({
        where: { accountId },
        include: {
            request: {
                include: {
                    sender: {
                        include: {
                            neupIds: {
                                where: { isPrimary: true },
                                take: 1
                            }
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const requests: Notification[] = [];
    const sticky: Notification[] = [];
    const other: Notification[] = [];

    for (const notif of notifications) {
        const baseNotification: Notification = {
            id: notif.id,
            isRead: notif.read,
            createdAt: notif.createdAt.toISOString(),
            deletableOn: notif.deletableOn?.toISOString() || null,
            action: notif.action || 'info',
            message: notif.message || undefined,
            persistence: notif.persistence as any,
            noticeType: notif.type as any,
        };

        if (notif.requestId && notif.request) {
            if (notif.request.status !== 'pending') continue;

            const sender = notif.request.sender;
            const senderName = sender.nameDisplay || `${sender.nameFirst || ''} ${sender.nameLast || ''}`.trim() || 'A user';
            const senderNeupId = sender.neupIds[0]?.id || 'N/A';

            requests.push({
                ...baseNotification,
                action: notif.request.action,
                requestId: notif.requestId,
                senderId: notif.request.senderId,
                senderName,
                senderNeupId,
            });
        } else if (notif.action && notif.action.endsWith('.sticky')) {
            if (notif.persistence === 'untildays' && notif.deletableOn) {
                if (notif.deletableOn < new Date()) continue;
            }
            if (notif.read) continue;

            sticky.push(baseNotification);
        } else {
            other.push(baseNotification);
        }
    }

    return { sticky, requests, other };
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const canMarkAsRead = await checkPermissions(['notification.read']);
    if (!canMarkAsRead) return { success: false };

    try {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true }
        });
        revalidatePath('/manage/notifications');
        return { success: true };
    } catch(error) {
        logError('database', error, 'markNotificationAsRead');
        return { success: false };
    }
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string; }> {
    const canDelete = await checkPermissions(['notification.delete']);
    if (!canDelete) return { success: false, error: "Permission denied." };
    
    try {
        await prisma.notification.delete({
            where: { id: notificationId }
        });
        revalidatePath('/manage/notifications');
        return { success: true };
    } catch (error) {
        logError('database', error, 'deleteNotification');
        return { success: false, error: "Could not delete notification." };
    }
}