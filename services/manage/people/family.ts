'use server';

import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logError } from '@/core/helpers/logger';
import { getUserProfile, checkPermissions } from '@/core/helpers/user';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { FamilyMember, FamilyGroup } from '@/types';

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
    const neupIdRecord = await prisma.neupId.findUnique({
      where: { id: neupId }
    });

    if (!neupIdRecord)
      return { success: false, error: 'No user found with that NeupID.' };

    const inviteeAccountId = neupIdRecord.accountId;
    if (inviteeAccountId === inviterAccountId)
      return { success: false, error: 'You cannot invite yourself.' };
      
    // Check if user is already in a family with the inviter.
    const family = await prisma.family.findFirst({
      where: {
        memberIds: {
          has: inviterAccountId
        }
      }
    });

    if (family && family.memberIds.includes(inviteeAccountId)) {
        return { success: false, error: 'This user is already in your family.' };
    }

    const existingRequest = await prisma.request.findFirst({
      where: {
        action: 'family_invitation',
        senderId: inviterAccountId,
        recipientId: inviteeAccountId,
        status: 'pending'
      }
    });

    if(existingRequest) {
        return { success: false, error: 'An invitation has already been sent to this user.' };
    }

    await prisma.$transaction(async (tx) => {
      const newRequest = await tx.request.create({
        data: {
          action: 'family_invitation',
          senderId: inviterAccountId,
          recipientId: inviteeAccountId,
          type: type,
          status: 'pending',
        }
      });
      
      await tx.notification.create({
        data: {
          accountId: inviteeAccountId,
          requestId: newRequest.id,
          type: 'info',
          title: 'Family Invitation',
          message: `You have received a family invitation.`,
          read: false,
        }
      });
    });

    revalidatePath('/manage/people/family');
    return { success: true };
  } catch (error) {
    await logError('database', error, `createInvite:${type}`);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}


/**
 * Function addFamilyMember.
 */
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


/**
 * Function addPartner.
 */
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
    const families = await prisma.family.findMany({
      where: {
        memberIds: {
          has: accountId
        }
      }
    });

    if (families.length === 0) return [];

    const populatedFamilies = await Promise.all(
      families.map(async (family) => {
        const members = (family.members as any[]) || [];
        const populatedMembers: FamilyMember[] = await Promise.all(
          members.map(async (member: any) => {
            const profile = await getUserProfile(member.accountId);
            const neupIdRecord = await prisma.neupId.findFirst({
              where: {
                accountId: member.accountId,
                isPrimary: true
              }
            });

            return {
              accountId: member.accountId,
              neupId: neupIdRecord?.id || 'N/A',
              displayName:
                profile?.nameDisplay ||
                `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() ||
                'Unknown User',
              displayPhoto: profile?.accountPhoto,
              status: 'approved',
              hidden: member.hidden,
              addedBy: member.addedBy,
            };
          })
        );

        return {
          id: family.id,
          createdBy: family.createdBy,
          members: populatedMembers,
        };
      })
    );

    return populatedFamilies;
  } catch (e) {
    await logError('database', e, 'fetchFamilyGroups');
    return [];
  }
}


/**
 * Function getFamilyGroups.
 */
export async function getFamilyGroups(): Promise<FamilyGroup[]> {
  return fetchFamilyGroups();
}


/**
 * Function removeFamilyMember.
 */
export async function removeFamilyMember(
  familyId: string,
  memberAccountId: string
): Promise<{ success: boolean; error?: string }> {
  const removerId = await getPersonalAccountId();
  if (!removerId) return { success: false, error: 'User not authenticated.' };

  const canRemoveFamily = await checkPermissions(['people.family.remove']);
  const canRemovePartner = await checkPermissions(['people.family.partner.remove']);

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId }
    });

    if (!family) return { success: false, error: 'Family not found.' };

    const memberIds = family.memberIds || [];
    const members = (family.members as any[]) || [];
    
    const memberToRemove = members.find(m => m.accountId === memberAccountId);
    if (!memberToRemove) return { success: false, error: "Member not found in family." };

    if (memberToRemove.hidden && !canRemovePartner) {
        return { success: false, error: "You don't have permission to remove a partner." };
    }
    if (!memberToRemove.hidden && !canRemoveFamily) {
        return { success: false, error: "You don't have permission to remove a family member." };
    }

    // Additional business logic: Only the creator of the family or the member themselves can remove someone.
    if (removerId !== family.createdBy && removerId !== memberAccountId) {
      return {
        success: false,
        error: "You don't have permission to remove this member.",
      };
    }

    const updatedMemberIds = memberIds.filter((id) => id !== memberAccountId);
    const updatedMembers = members.filter(
      (m) => m.accountId !== memberAccountId
    );

    await prisma.family.update({
      where: { id: familyId },
      data: {
        memberIds: updatedMemberIds,
        members: updatedMembers,
      }
    });

    revalidatePath('/manage/people/family');
    return { success: true };
  } catch (e) {
    await logError('database', e, 'removeFamilyMember');
    return { success: false, error: 'An unexpected error occurred.' };
  }
}