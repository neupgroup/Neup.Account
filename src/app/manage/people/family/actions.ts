

'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit,
  deleteDoc,
  doc,
  getDoc,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { getPersonalAccountId } from '@/actions/auth/session';
import { logError } from '@/lib/logger';
import { getUserProfile, checkPermissions, getUserNeupIds } from '@/lib/user-actions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type FamilyMember = {
  accountId: string;
  neupId: string;
  displayName: string;
  displayPhoto?: string;
  status: 'pending' | 'approved';
  hidden: boolean;
  addedBy: string;
};

export type FamilyGroup = {
  id: string; // family doc id
  createdBy: string;
  members: FamilyMember[];
};

const addAccountSchema = z.object({
  neupId: z
    .string()
    .min(3, 'NeupID must be at least 3 characters.')
    .max(30, 'NeupID cannot be more than 30 characters.'),
});

// --- NEW INVITATION-BASED LOGIC ---

async function createInvite(
  neupId: string,
  type: 'member' | 'partner'
): Promise<{ success: boolean; error?: string }> {
  const inviterAccountId = await getPersonalAccountId();
  if (!inviterAccountId) return { success: false, error: 'User not authenticated.' };

  try {
    const neupidRef = doc(db, 'neupid', neupId);
    const userSnapshot = await getDoc(neupidRef);

    if (!userSnapshot.exists())
      return { success: false, error: 'No user found with that NeupID.' };

    const inviteeAccountId = userSnapshot.data().for;
    if (inviteeAccountId === inviterAccountId)
      return { success: false, error: 'You cannot invite yourself.' };
      
    // Check if user is already in a family with the inviter.
    const familyQuery = query(collection(db, 'family'), where('memberIds', 'array-contains', inviterAccountId));
    const familySnapshot = await getDocs(familyQuery);
    if (!familySnapshot.empty) {
        const familyData = familySnapshot.docs[0].data();
        if (familyData.memberIds.includes(inviteeAccountId)) {
            return { success: false, error: 'This user is already in your family.' };
        }
    }


    const requestsRef = collection(db, 'requests');
    const q = query(
        requestsRef,
        where('action', '==', 'family_invitation'),
        where('sender_id', '==', inviterAccountId),
        where('recipient_id', '==', inviteeAccountId),
        where('status', '==', 'pending')
    );
    const existingRequests = await getDocs(q);
    if(!existingRequests.empty) {
        return { success: false, error: 'An invitation has already been sent to this user.' };
    }


    const newRequestRef = await addDoc(requestsRef, {
        action: 'family_invitation',
        request_to: 'account',
        sender_id: inviterAccountId,
        recipient_id: inviteeAccountId,
        type: type, // 'member' or 'partner'
        status: 'pending',
        createdAt: serverTimestamp(),
    });
    
    // Create notification
    await addDoc(collection(db, 'notifications'), {
        recipient_id: inviteeAccountId,
        request_id: newRequestRef.id,
        is_read: false,
        createdAt: serverTimestamp()
    });


    revalidatePath('/manage/people/family');
    return { success: true };
  } catch (error) {
    await logError('database', error, `createInvite:${type}`);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function addFamilyMember(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const canAdd = await checkPermissions(['people.family.add']);
  if (!canAdd) return { success: false, error: 'Permission denied.' };

  const validation = addAccountSchema.safeParse({
    neupId: formData.get('neupId'),
  });
  if (!validation.success)
    return {
      success: false,
      error: validation.error.flatten().fieldErrors.neupId?.[0],
    };
  return createInvite(validation.data.neupId, 'member');
}

export async function addPartner(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const canAdd = await checkPermissions(['people.family.partner.add']);
  if (!canAdd) return { success: false, error: 'Permission denied.' };

  const validation = addAccountSchema.safeParse({
    neupId: formData.get('neupId'),
  });
  if (!validation.success)
    return {
      success: false,
      error: validation.error.flatten().fieldErrors.neupId?.[0],
    };
  return createInvite(validation.data.neupId, 'partner');
}


// --- DATA FETCHING FOR DISPLAY ---

async function fetchFamilyGroups(): Promise<FamilyGroup[]> {
  const canView = await checkPermissions(['people.family.view']);
  if (!canView) return [];
  
  const accountId = await getPersonalAccountId();
  if (!accountId) return [];

  try {
    const familyCol = collection(db, 'family');
    const q = query(familyCol, where('memberIds', 'array-contains', accountId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return [];

    const families = await Promise.all(
      querySnapshot.docs.map(async (familyDoc) => {
        const familyData = familyDoc.data();
        const populatedMembers: FamilyMember[] = await Promise.all(
          (familyData.members || []).map(async (member: any) => {
            const profile = await getUserProfile(member.accountId);
            const neupids = await getDocs(
              query(
                collection(db, 'neupid'),
                where('for', '==', member.accountId),
                limit(1)
              )
            );

            return {
              accountId: member.accountId,
              neupId: neupids.docs[0]?.id || 'N/A',
              displayName:
                profile?.displayName ||
                `${profile?.firstName} ${profile?.lastName}`.trim() ||
                'Unknown User',
              displayPhoto: profile?.displayPhoto,
              status: 'approved',
              hidden: member.hidden,
              addedBy: member.addedBy,
            };
          })
        );

        return {
          id: familyDoc.id,
          createdBy: familyData.createdBy,
          members: populatedMembers,
        };
      })
    );

    return families;
  } catch (e) {
    await logError('database', e, 'fetchFamilyGroups');
    return [];
  }
}

export async function getFamilyGroups(): Promise<FamilyGroup[]> {
  return fetchFamilyGroups();
}

export async function removeFamilyMember(
  familyId: string,
  memberAccountId: string
): Promise<{ success: boolean; error?: string }> {
  const removerId = await getPersonalAccountId();
  if (!removerId) return { success: false, error: 'User not authenticated.' };

  const canRemoveFamily = await checkPermissions(['people.family.remove']);
  const canRemovePartner = await checkPermissions(['people.family.partner.remove']);

  try {
    const familyDocRef = doc(db, 'family', familyId);
    const familyDoc = await getDoc(familyDocRef);

    if (!familyDoc.exists()) return { success: false, error: 'Family not found.' };

    const familyData = familyDoc.data();
    const memberIds: string[] = familyData.memberIds || [];
    const members: any[] = familyData.members || [];
    
    const memberToRemove = members.find(m => m.accountId === memberAccountId);
    if (!memberToRemove) return { success: false, error: "Member not found in family." };

    if (memberToRemove.hidden && !canRemovePartner) {
        return { success: false, error: "You don't have permission to remove a partner." };
    }
    if (!memberToRemove.hidden && !canRemoveFamily) {
        return { success: false, error: "You don't have permission to remove a family member." };
    }

    // Additional business logic: Only the creator of the family or the member themselves can remove someone.
    if (removerId !== familyData.createdBy && removerId !== memberAccountId) {
      return {
        success: false,
        error: "You don't have permission to remove this member.",
      };
    }

    const updatedMemberIds = memberIds.filter((id) => id !== memberAccountId);
    const updatedMembers = members.filter(
      (m) => m.accountId !== memberAccountId
    );

    await updateDoc(familyDocRef, {
      memberIds: updatedMemberIds,
      members: updatedMembers,
    });

    revalidatePath('/manage/people/family');
    return { success: true };
  } catch (e) {
    await logError('database', e, 'removeFamilyMember');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}
