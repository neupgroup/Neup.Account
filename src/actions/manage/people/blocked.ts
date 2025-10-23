'use server';

import { db } from '@/lib/firebase';
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from 'firebase/firestore';
import { getPersonalAccountId } from '@/lib/auth-actions';
import { getUserProfile, getUserNeupIds } from '@/lib/user';
import { logError } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const neupIdSchema = z.object({
  neupId: z.string().min(3, 'NeupID must be at least 3 characters.'),
});

export type BlockedUser = {
  accountId: string;
  neupId: string;
  displayName: string;
  displayPhoto?: string;
};

// Helper function to get the account document for the current user
async function getAccountDoc(accountId: string) {
  const accountRef = doc(db, 'account', accountId);
  const accountDoc = await getDoc(accountRef);
  if (!accountDoc.exists()) {
    // This case should ideally not happen for an authenticated user
    // but is a safeguard.
    return { ref: accountRef, data: { blockList: [], restrictList: [] } };
  }
  return { ref: accountRef, data: accountDoc.data() };
}

// Helper function to find a user's account ID by their NeupID
async function findAccountIdByNeupId(neupId: string): Promise<string | null> {
  try {
    const neupidRef = doc(db, 'neupid', neupId);
    const neupidDoc = await getDoc(neupidRef);
    return neupidDoc.exists() ? neupidDoc.data().for : null;
  } catch (error) {
    await logError('database', error, `findAccountIdByNeupId: ${neupId}`);
    return null;
  }
}

// Unified function to fetch either blocked or restricted users
async function getList(type: 'blockList' | 'restrictList'): Promise<BlockedUser[]> {
  const accountId = await getPersonalAccountId();
  if (!accountId) return [];

  try {
    const { data } = await getAccountDoc(accountId);
    const listAccountIds: string[] = data[type] || [];

    if (listAccountIds.length === 0) return [];

    const userPromises = listAccountIds.map(async (blockedAccountId) => {
      const [profile, neupIds] = await Promise.all([
        getUserProfile(blockedAccountId),
        getUserNeupIds(blockedAccountId),
      ]);
      return {
        accountId: blockedAccountId,
        neupId: neupIds[0] || 'N/A',
        displayName: profile?.nameDisplay || `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() || 'Unknown User',
        displayPhoto: profile?.accountPhoto,
      };
    });

    return Promise.all(userPromises);
  } catch (error) {
    await logError('database', error, `getList (${type})`);
    return [];
  }
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  return getList('blockList');
}

export async function getRestrictedUsers(): Promise<BlockedUser[]> {
  return getList('restrictList');
}

// Unified function to add a user to a list
async function addUserToList(neupId: string, type: 'blockList' | 'restrictList'): Promise<{ success: boolean; error?: string; }> {
  const validation = neupIdSchema.safeParse({ neupId });
  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors.neupId?.[0] || 'Invalid input' };
  }

  const ownerAccountId = await getPersonalAccountId();
  if (!ownerAccountId) return { success: false, error: 'User not authenticated.' };

  const targetAccountId = await findAccountIdByNeupId(neupId);
  if (!targetAccountId) return { success: false, error: 'User with that NeupID not found.' };

  if (targetAccountId === ownerAccountId) {
    return { success: false, error: `You cannot ${type === 'blockList' ? 'block' : 'restrict'} yourself.` };
  }

  try {
    const { ref } = await getAccountDoc(ownerAccountId);
    await updateDoc(ref, {
      [type]: arrayUnion(targetAccountId),
    });
    revalidatePath('/manage/people/blocked');
    return { success: true };
  } catch (error) {
    await logError('database', error, `addUserToList (${type})`);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function blockUser(neupId: string) {
  return addUserToList(neupId, 'blockList');
}

export async function restrictUser(neupId: string) {
  return addUserToList(neupId, 'restrictList');
}

// Unified function to remove a user from a list
async function removeUserFromList(accountId: string, type: 'blockList' | 'restrictList'): Promise<{ success: boolean; error?: string; }> {
  const ownerAccountId = await getPersonalAccountId();
  if (!ownerAccountId) return { success: false, error: 'User not authenticated.' };

  try {
    const { ref } = await getAccountDoc(ownerAccountId);
    await updateDoc(ref, {
      [type]: arrayRemove(accountId),
    });
    revalidatePath('/manage/people/blocked');
    return { success: true };
  } catch (error) {
    await logError('database', error, `removeUserFromList (${type})`);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function unblockUser(accountId: string) {
  return removeUserFromList(accountId, 'blockList');
}

export async function unrestrictUser(accountId: string) {
  return removeUserFromList(accountId, 'restrictList');
}