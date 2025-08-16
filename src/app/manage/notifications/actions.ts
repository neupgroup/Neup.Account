

'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getUnreadWarnings, markWarningAsRead, type UserWarning, getUserProfile, checkPermissions } from "@/lib/user-actions";
import { getPendingInvitations as getAccessInvites, acceptInvitation as acceptAccess, rejectInvitation as rejectAccess, type Invitation as AccessInvite } from "@/app/manage/access/actions";
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';

export type Notification = {
    id: string; // notification doc id
    requestId: string;
    action: string;
    senderId: string;
    senderName: string;
    senderNeupId: string;
    isRead: boolean;
    createdAt: string;
}

export type AllNotifications = {
    warnings: UserWarning[];
    requests: Notification[];
};

export async function getNotifications(): Promise<AllNotifications> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return { warnings: [], requests: [] };

    const [warnings] = await Promise.all([
        getUnreadWarnings(),
    ]);

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('recipient_id', '==', accountId));
    const querySnapshot = await getDocs(q);

    const requests: Notification[] = [];
    for (const notifDoc of querySnapshot.docs) {
        const notifData = notifDoc.data();
        const requestRef = doc(db, 'requests', notifData.request_id);
        const requestDoc = await getDoc(requestRef);

        if (requestDoc.exists()) {
            const requestData = requestDoc.data();
            const senderProfile = await getUserProfile(requestData.sender_id);
            const senderNeupIds = await getDocs(query(collection(db, 'neupid'), where('for', '==', requestData.sender_id)));

            requests.push({
                id: notifDoc.id,
                requestId: notifData.request_id,
                action: requestData.action,
                senderId: requestData.sender_id,
                senderName: senderProfile?.displayName || 'A user',
                senderNeupId: senderNeupIds.docs[0]?.id || 'N/A',
                isRead: notifData.is_read,
                createdAt: notifData.createdAt?.toDate().toLocaleString() || new Date().toLocaleString(),
            });
        }
    }


    return {
        warnings,
        requests
    };
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const canMarkAsRead = await checkPermissions(['notification.mark_as_read']);
    if (!canMarkAsRead) return { success: false };

    try {
        const notifRef = doc(db, 'notifications', notificationId);
        await updateDoc(notifRef, { is_read: true });
        return { success: true };
    } catch(error) {
        logError('database', error, 'markNotificationAsRead');
        return { success: false };
    }
}

export async function acceptRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
     const inviteeId = await getPersonalAccountId();
    if (!inviteeId) return { success: false, error: 'User not authenticated.' };

    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) return { success: false, error: 'Request not found.' };

    const requestData = requestDoc.data();
    if (requestData.action === 'family_invitation') {
        // Find existing family group for either user
        const familyRef = collection(db, 'family');
        const inviterId = requestData.sender_id;

        const q1 = query(familyRef, where('memberIds', 'array-contains', inviterId), limit(1));
        const q2 = query(familyRef, where('memberIds', 'array-contains', inviteeId), limit(1));
        const [inviterFamilySnap, inviteeFamilySnap] = await Promise.all([getDocs(q1), getDocs(q2)]);

        let familyDocRef: any;
        let familyData: any = {};
        if (!inviterFamilySnap.empty) {
            familyDocRef = inviterFamilySnap.docs[0].ref;
            familyData = inviterFamilySnap.docs[0].data();
        } else if (!inviteeFamilySnap.empty) {
            familyDocRef = inviteeFamilySnap.docs[0].ref;
            familyData = inviteeFamilySnap.docs[0].data();
        } else {
            familyDocRef = doc(familyRef);
            familyData = { createdBy: inviterId, memberIds: [], members: [] };
        }

        const updatedMembers = familyData.members || [];
        const updatedMemberIds = familyData.memberIds || [];
        if (!updatedMemberIds.includes(inviterId)) {
            updatedMembers.push({ accountId: inviterId, addedOn: serverTimestamp(), addedBy: inviterId, hidden: false, status: 'approved' });
            updatedMemberIds.push(inviterId);
        }
        if (!updatedMemberIds.includes(inviteeId)) {
            updatedMembers.push({ accountId: inviteeId, addedOn: serverTimestamp(), addedBy: inviterId, hidden: requestData.type === 'partner', status: 'approved' });
            updatedMemberIds.push(inviteeId);
        }

        await setDoc(familyDocRef, { ...familyData, members: updatedMembers, memberIds: updatedMemberIds}, { merge: true });
    }

    const batch = writeBatch(db);
    batch.delete(requestRef);
    batch.delete(doc(db, 'notifications', notificationId));
    await batch.commit();

    return { success: true };
}

export async function rejectRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'requests', requestId));
    batch.delete(doc(db, 'notifications', notificationId));
    await batch.commit();
    return { success: true };
}
