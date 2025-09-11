
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, writeBatch, setDoc, limit, Timestamp, addDoc } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { checkPermissions, getUserProfile } from '@/lib/user';
import type { Notification, AllNotifications, NotificationCreate } from '@/types';


export async function createNotification(data: NotificationCreate) {
    try {
        await addDoc(collection(db, 'notifications'), {
            ...data,
            is_read: false,
            createdAt: serverTimestamp(),
        });
    } catch (e) {
        await logError('database', e, `createNotification for ${data.recipient_id}`);
    }
}


export async function getNotifications(): Promise<AllNotifications> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return { sticky: [], requests: [], other: [] };

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('recipient_id', '==', accountId));
    const querySnapshot = await getDocs(q);

    const requests: Notification[] = [];
    const sticky: Notification[] = [];
    const other: Notification[] = [];

    for (const notifDoc of querySnapshot.docs) {
        const notifData = notifDoc.data();
        const baseNotification = {
            id: notifDoc.id,
            isRead: notifData.is_read,
            createdAt: notifData.createdAt?.toDate().toISOString() || new Date().toISOString(),
            action: notifData.action,
        };

        if (notifData.request_id) { // This is a request-based notification
            const requestRef = doc(db, 'requests', notifData.request_id);
            const requestDoc = await getDoc(requestRef);

            if (requestDoc.exists()) {
                const requestData = requestDoc.data();
                if (requestData.status !== 'pending') continue; // Only show pending requests

                const senderProfile = await getUserProfile(requestData.sender_id);
                const senderNeupIds = await getDocs(query(collection(db, 'neupid'), where('for', '==', requestData.sender_id)));

                requests.push({
                    ...baseNotification,
                    requestId: notifData.request_id,
                    senderId: requestData.sender_id,
                    senderName: senderProfile?.displayName || `${senderProfile?.firstName} ${senderProfile?.lastName}`.trim() || 'A user',
                    senderNeupId: senderNeupIds.docs[0]?.id || 'N/A',
                });
            }
        } else if (notifData.action && notifData.action.endsWith('.sticky')) { // This is a sticky warning/notice
             if (notifData.persistence === 'untildays' && notifData.expiresOn) {
                const expires = notifData.expiresOn.toDate();
                if (expires < new Date()) continue; // Skip expired notices
            }
            if (notifData.is_read) continue; // Skip read notices

            sticky.push({
                ...baseNotification,
                message: notifData.message,
                persistence: notifData.persistence,
                noticeType: notifData.noticeType,
            });
        } else {
            // This is a normal, informative notification
             other.push({
                ...baseNotification,
                message: notifData.message,
            });
        }
    }
    
    const sortByDate = (a: Notification, b: Notification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    requests.sort(sortByDate);
    sticky.sort(sortByDate);
    other.sort(sortByDate);

    return { sticky, requests, other };
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const canMarkAsRead = await checkPermissions(['notification.read']);
    if (!canMarkAsRead) return { success: false };

    try {
        const notifRef = doc(db, 'notifications', notificationId);
        const notifDoc = await getDoc(notifRef);
        if (notifDoc.exists()) {
            await updateDoc(notifRef, { is_read: true });
        }
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
        const notifRef = doc(db, 'notifications', notificationId);
        await deleteDoc(notifRef);
        revalidatePath('/manage/notifications');
        return { success: true };
    } catch (error) {
        logError('database', error, 'deleteNotification');
        return { success: false, error: "Could not delete notification." };
    }
}
