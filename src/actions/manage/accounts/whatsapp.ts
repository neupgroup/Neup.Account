 'use server';
 
 import { getActiveAccountId } from '@/lib/auth-actions';
 import { logError } from '@/lib/logger';
 import { z } from 'zod';
 import { whatsAppFormSchema, verifyCodeSchema } from '@/app/(manage)/accounts/whatsapp/schema';
 import { revalidatePath } from 'next/cache';
 
 export async function sendVerificationCode(data: z.infer<typeof whatsAppFormSchema>): Promise<{ success: boolean; error?: string }> {
   const accountId = await getActiveAccountId();
   if (!accountId) {
     return { success: false, error: 'User not authenticated.' };
   }
 
   const validation = whatsAppFormSchema.safeParse(data);
   if (!validation.success) {
     return { success: false, error: validation.error.flatten().fieldErrors.whatsappNumber?.[0] };
   }
 
   const { whatsappNumber } = validation.data;
 
   try {
     console.log(`Simulating sending verification code to ${whatsappNumber} for account ${accountId}`);
     return { success: true };
   } catch (error) {
     await logError('unknown', error, `sendVerificationCode: ${accountId}`);
     return { success: false, error: 'An unexpected error occurred.' };
   }
 }
 
 export async function linkWhatsAppAccount(data: z.infer<typeof verifyCodeSchema>): Promise<{ success: boolean; error?: string }> {
   const accountId = await getActiveAccountId();
   if (!accountId) {
     return { success: false, error: 'User not authenticated.' };
   }
 
   const validation = verifyCodeSchema.safeParse(data);
   if (!validation.success) {
     return { success: false, error: validation.error.flatten().fieldErrors.code?.[0] };
   }
 
   const { code, whatsappNumber } = validation.data;
 
   try {
     if (code === '123456') {
      console.log(`Successfully linked WhatsApp number ${whatsappNumber} to account ${accountId}`);
      revalidatePath('/accounts/whatsapp');
      return { success: true };
    }
     return { success: false, error: 'The verification code is incorrect.' };
   } catch (error) {
     await logError('unknown', error, `linkWhatsAppAccount: ${accountId}`);
     return { success: false, error: 'An unexpected error occurred.' };
   }
 }
 
