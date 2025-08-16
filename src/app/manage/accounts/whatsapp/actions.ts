
'use server';

import { getActiveAccountId } from '@/lib/auth-actions';
import { logError } from '@/lib/logger';
import { z } from 'zod';
import { whatsAppFormSchema, verifyCodeSchema } from './schema';
import { revalidatePath } from 'next/cache';


// In a real application, this would interact with a service like Twilio to send a verification code.
export async function sendVerificationCode(data: z.infer<typeof whatsAppFormSchema>): Promise<{ success: boolean; error?: string; }> {
    const accountId = await getActiveAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }

    const validation = whatsAppFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.whatsappNumber?.[0] };
    }
    
    const { whatsappNumber } = validation.data;

    try {
        // --- MOCK IMPLEMENTATION ---
        // In a real app:
        // 1. Generate a 6-digit code.
        // 2. Store the code and its expiry time, associated with the phone number or accountId.
        // 3. Use a WhatsApp API provider to send the code to `whatsappNumber`.
        console.log(`Simulating sending verification code to ${whatsappNumber} for account ${accountId}`);
        // For demonstration, we'll always return success.
        
        return { success: true };

    } catch (error) {
        await logError('unknown', error, `sendVerificationCode: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}


// In a real application, this would verify the code sent to the user.
export async function linkWhatsAppAccount(data: z.infer<typeof verifyCodeSchema>): Promise<{ success: boolean; error?: string; }> {
    const accountId = await getActiveAccountId();
    if (!accountId) {
        return { success: false, error: "User not authenticated." };
    }
    
    const validation = verifyCodeSchema.safeParse(data);
     if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.code?.[0] };
    }

    const { code, whatsappNumber } = validation.data;

    try {
        // --- MOCK IMPLEMENTATION ---
        // In a real app:
        // 1. Retrieve the stored code for the user/phone number.
        // 2. Check if it has expired.
        // 3. Compare the stored code with the user-provided `code`.
        // 4. If it matches, save the `whatsappNumber` to the user's profile (e.g., in `account_contacts`).
        // 5. Delete the used verification code.

        if (code === '123456') { // Simulate a successful verification
            console.log(`Successfully linked WhatsApp number ${whatsappNumber} to account ${accountId}`);
            revalidatePath('/manage/accounts/whatsapp');
            return { success: true };
        } else { // Simulate a failed verification
             return { success: false, error: "The verification code is incorrect." };
        }

    } catch (error) {
        await logError('unknown', error, `linkWhatsAppAccount: ${accountId}`);
        return { success: false, error: "An unexpected error occurred." };
    }
}
