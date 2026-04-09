 'use server';
 
 import prisma from '@/core/helpers/prisma';
 import { getPersonalAccountId } from '@/core/helpers/auth-actions';
 import { logError } from '@/core/helpers/logger';
 import { getUserProfile, checkPermissions } from '@/core/helpers/user';
 import { revalidatePath } from 'next/cache';
 import { z } from 'zod';
 
 /**
  * Type RecoveryAccount.
  */
 export type RecoveryAccount = {
   id: string;
   recoveryAccountId: string;
   recoveryNeupId: string;
   displayName: string;
   displayPhoto?: string;
   status: 'pending' | 'approved' | 'rejected';
 };
 
 const addAccountSchema = z.object({
   neupId: z.string().min(3, 'NeupID must be at least 3 characters.').max(16, 'NeupID cannot be more than 16 characters.'),
 });
 
 const statusOrder: Record<RecoveryAccount['status'], number> = {
   approved: 1,
   pending: 2,
   rejected: 3,
 };


 /**
  * Function getRecoveryAccounts.
  */
 export async function getRecoveryAccounts(): Promise<RecoveryAccount[]> {
   const canView = await checkPermissions(['security.recovery_accounts.view']);
   if (!canView) return [];
 
   const ownerAccountId = await getPersonalAccountId();
   if (!ownerAccountId) return [];
 
   try {
    const rows = await prisma.recoveryContact.findMany({
      where: { ownerAccountId },
    });
 
    if (rows.length === 0) return [];
 
    const recoveryContacts = await Promise.all(
      rows.map(async (r) => {
        const profile = await getUserProfile(r.recoveryAccountId);
        return {
          id: r.id,
          recoveryAccountId: r.recoveryAccountId,
          recoveryNeupId: r.recoveryNeupId,
          displayName:
            profile?.nameDisplay ||
            `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() ||
            r.recoveryNeupId,
          displayPhoto: profile?.accountPhoto,
          status: (r.status || 'pending') as 'pending' | 'approved' | 'rejected',
        };
      }),
    );
 
     recoveryContacts.sort((a: RecoveryAccount, b: RecoveryAccount) => statusOrder[a.status] - statusOrder[b.status]);
 
     return recoveryContacts;
   } catch (error) {
     await logError('database', error, 'getRecoveryAccounts');
     return [];
   }
 }


 /**
  * Function addRecoveryAccount.
  */
 export async function addRecoveryAccount(formData: FormData): Promise<{ success: boolean; error?: string; newAccount?: RecoveryAccount }> {
   const canAdd = await checkPermissions(['security.recovery_accounts.add']);
   if (!canAdd) return { success: false, error: 'Permission denied.' };
 
   const ownerAccountId = await getPersonalAccountId();
   if (!ownerAccountId) return { success: false, error: 'User not authenticated.' };
 
   const validation = addAccountSchema.safeParse({ neupId: formData.get('neupId') });
   if (!validation.success) {
     return { success: false, error: validation.error.flatten().fieldErrors.neupId?.[0] };
   }
 
   const { neupId } = validation.data;
 
   try {
    const count = await prisma.recoveryContact.count({
      where: { ownerAccountId },
    });
    if (count >= 5) {
       return { success: false, error: 'You cannot add more than 5 recovery accounts.' };
     }
 
    const neup = await prisma.neupId.findUnique({ where: { id: neupId } });
 
    if (!neup) {
       return { success: false, error: 'No user found with that NeupID.' };
     }
    const recoveryAccountId = neup.accountId;
 
     if (recoveryAccountId === ownerAccountId) {
       return { success: false, error: 'You cannot add yourself as a recovery account.' };
     }
 
    const exists = await prisma.recoveryContact.findFirst({
      where: { ownerAccountId, recoveryAccountId },
    });
    if (exists) {
       return { success: false, error: 'This account has already been added.' };
     }
 
    const created = await prisma.recoveryContact.create({
      data: {
        ownerAccountId,
        recoveryAccountId,
        recoveryNeupId: neupId,
        status: 'pending',
      },
    });
 
     const profile = await getUserProfile(recoveryAccountId);
 
     const newAccountData: RecoveryAccount = {
      id: created.id,
       recoveryAccountId,
       recoveryNeupId: neupId,
       displayName:
         profile?.nameDisplay ||
         `${profile?.nameFirst || ''} ${profile?.nameLast || ''}`.trim() ||
         neupId,
       displayPhoto: profile?.accountPhoto,
       status: 'pending',
     };
 
     revalidatePath('/manage/security/account');
     return { success: true, newAccount: newAccountData };
   } catch (error) {
     await logError('database', error, 'addRecoveryAccount');
     return { success: false, error: 'An unexpected error occurred.' };
   }
 }


 /**
  * Function removeRecoveryAccount.
  */
 export async function removeRecoveryAccount(id: string): Promise<{ success: boolean; error?: string }> {
   const canRemove = await checkPermissions(['security.recovery_accounts.remove']);
   if (!canRemove) return { success: false, error: 'Permission denied.' };
 
   const ownerAccountId = await getPersonalAccountId();
   if (!ownerAccountId) return { success: false, error: 'User not authenticated.' };
 
   try {
    const row = await prisma.recoveryContact.findUnique({ where: { id } });
 
    if (!row || row.ownerAccountId !== ownerAccountId) {
       return { success: false, error: 'Permission denied or account not found.' };
     }
 
    await prisma.recoveryContact.delete({ where: { id } });
 
     revalidatePath('/manage/security/account');
     return { success: true };
   } catch (error) {
     await logError('database', error, `removeRecoveryAccount: ${id}`);
     return { success: false, error: 'An unexpected error occurred.' };
   }
 }
 
