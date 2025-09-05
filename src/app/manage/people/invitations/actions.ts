'use server';

import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, serverTimestamp, writeBatch, setDoc, limit, Timestamp } from 'firebase/firestore';
import { getUserProfile, getUserNeupIds, checkPermissions } from '@/lib/user';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import type { Invitation } from '@/types';


export async function getInvitations(): Promise<Invitation[]> {
    const accountId = await getPersonalAccountId();
    if (!accountId) return [];

    const notificationsRef = collection(db, 'notifications');
    const q = query(notificationsRef, where('recipient_id', '==', accountId));
    const querySnapshot = await getDocs(q);

    const invitations: Invitation[] = [];
    for (const notifDoc of querySnapshot.docs) {
        const notifData = notifDoc.data();
        
        if (!notifData.request_id) continue;

        const requestRef = doc(db, 'requests', notifData.request_id);
        const requestDoc = await getDoc(requestRef);

        if (requestDoc.exists() && requestDoc.data().status === 'pending') {
            const requestData = requestDoc.data();
            const senderProfile = await getUserProfile(requestData.sender_id);
            const senderNeupIds = await getDocs(query(collection(db, 'neupid'), where('for', '==', requestData.sender_id)));

            invitations.push({
                notificationId: notifDoc.id,
                requestId: notifData.request_id,
                action: requestData.action,
                senderId: requestData.sender_id,
                senderName: senderProfile?.displayName || `${senderProfile?.firstName} ${senderProfile?.lastName}`.trim() || 'A user',
                senderNeupId: senderNeupIds.docs[0]?.id || 'N/A',
                createdAt: notifData.createdAt?.toDate().toISOString() || new Date().toISOString(),
            });
        }
    }

    invitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return invitations;
}

export async function acceptRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
     const inviteeId = await getPersonalAccountId();
    if (!inviteeId) return { success: false, error: 'User not authenticated.' };

    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) return { success: false, error: 'Request not found.' };

    const requestData = requestDoc.data();
    if (requestData.recipient_id !== inviteeId) {
        return { success: false, error: 'This invitation is not for you.' };
    }

    const batch = writeBatch(db);

    if (requestData.action === 'family_invitation') {
        const familyRef = collection(db, 'family');
        const inviterId = requestData.sender_id;

        const q1 = query(familyRef, where('memberIds', 'array-contains', inviterId));
        const q2 = query(familyRef, where('memberIds', 'array-contains', inviteeId));
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
        const now = Timestamp.now(); // Use a standard Timestamp

        if (!updatedMemberIds.includes(inviterId)) {
            updatedMembers.push({ accountId: inviterId, addedOn: now, addedBy: inviterId, hidden: false, status: 'approved' });
            updatedMemberIds.push(inviterId);
        }
        if (!updatedMemberIds.includes(inviteeId)) {
            updatedMembers.push({ accountId: inviteeId, addedOn: now, addedBy: inviterId, hidden: requestData.type === 'partner', status: 'approved' });
            updatedMemberIds.push(inviteeId);
        }

        batch.set(familyDocRef, { ...familyData, members: updatedMembers, memberIds: updatedMemberIds}, { merge: true });

    } else if (requestData.action === 'access_invitation') {
        const permitRef = doc(collection(db, 'permit'));
        const defaultPermQuery = query(collection(db, 'permission'), where('name', '==', 'individual.default'), limit(1));
        const defaultPermSnap = await getDocs(defaultPermQuery);
        const permId = defaultPermSnap.empty ? 'individual.default' : defaultPermSnap.docs[0].id;
        
        batch.set(permitRef, {
            account_id: inviteeId,
            target_id: requestData.sender_id,
            permission: [permId],
            is_root: false,
            created_on: serverTimestamp(),
            approved_on: serverTimestamp()
        });
    }

    batch.update(requestRef, { status: 'approved' });
    batch.delete(doc(db, 'notifications', notificationId));
    await batch.commit();

    revalidatePath('/manage/people/invitations');
    revalidatePath('/manage/notifications');
    revalidatePath('/manage/access');
    revalidatePath('/manage/people/family');
    return { success: true };
}

export async function rejectRequest(requestId: string, notificationId: string): Promise<{ success: boolean; error?: string }> {
    const inviteeId = await getPersonalAccountId();
    if (!inviteeId) return { success: false, error: 'User not authenticated.' };

    const requestRef = doc(db, 'requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists() || requestDoc.data().recipient_id !== inviteeId) {
        return { success: false, error: 'Request not found or you do not have permission to reject it.' };
    }

    const batch = writeBatch(db);
    batch.update(requestRef, { status: 'rejected' });
    batch.delete(doc(db, 'notifications', notificationId));
    await batch.commit();

    revalidatePath('/manage/people/invitations');
    revalidatePath('/manage/notifications');
    return { success: true };
}
