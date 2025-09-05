
'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, writeBatch, setDoc, limit, Timestamp } from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { checkPermissions, getUserProfile } from '@/lib/user';
import type { Notification, AllNotifications } from '@/types';


export async function getNotifications(): Promise<AllNotifications> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return { sticky: [], requests: [] };

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('recipient_id', '==', accountId));
    const querySnapshot = await getDocs(q);

    const requests: Notification[] = [];
    const sticky: Notification[] = [];

    for (const notifDoc of querySnapshot.docs) {
        const notifData = notifDoc.data();
        
        if (notifData.request_id) { // This is a request-based notification
            const requestRef = doc(db, 'requests', notifData.request_id);
            const requestDoc = await getDoc(requestRef);

            if (requestDoc.exists()) {
                const requestData = requestDoc.data();
                if (requestData.status !== 'pending') continue; // Only show pending requests

                const senderProfile = await getUserProfile(requestData.sender_id);
                const senderNeupIds = await getDocs(query(collection(db, 'neupid'), where('for', '==', requestData.sender_id)));

                requests.push({
                    id: notifDoc.id,
                    requestId: notifData.request_id,
                    action: requestData.action,
                    senderId: requestData.sender_id,
                    senderName: senderProfile?.displayName || `${senderProfile?.firstName} ${senderProfile?.lastName}`.trim() || 'A user',
                    senderNeupId: senderNeupIds.docs[0]?.id || 'N/A',
                    isRead: notifData.is_read,
                    createdAt: notifData.createdAt?.toDate().toISOString() || new Date().toISOString(),
                });
            }
        } else if (notifData.action && notifData.action.endsWith('.sticky')) { // This is a sticky warning/notice
             if (notifData.persistence === 'untildays' && notifData.expiresOn) {
                const expires = notifData.expiresOn.toDate();
                if (expires < new Date()) continue; // Skip expired notices
            }
            if (notifData.is_read) continue; // Skip read notices

            sticky.push({
                id: notifDoc.id,
                action: notifData.action,
                message: notifData.message,
                persistence: notifData.persistence,
                noticeType: notifData.noticeType,
                isRead: notifData.is_read,
                createdAt: notifData.createdAt?.toDate().toISOString() || new Date().toISOString(),
            });
        }
    }

    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    sticky.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    return {
        sticky,
        requests
    };
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const canMarkAsRead = await checkPermissions(['notification.mark_as_read']);
    if (!canMarkAsRead) return { success: false };

    try {
        const notifRef = doc(db, 'notifications', notificationId);
        const notifDoc = await getDoc(notifRef);
        if (notifDoc.exists() && notifDoc.data().persistence === 'dismissable') {
             await updateDoc(notifRef, { is_read: true });
        }
        return { success: true };
    } catch(error) {
        logError('database', error, 'markNotificationAsRead');
        return { success: false };
    }
}
