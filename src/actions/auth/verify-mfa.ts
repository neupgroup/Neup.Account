'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { headers } from 'next/headers';
import { authenticator } from 'otplib';
import { decrypt } from '@/actions/security/totp';
import { z } from 'zod';
import { createAndSetSession } from '@/lib/session';
import { logActivity } from '@/lib/log-actions';
import { getAuthRequest } from './utils';

const mfaSchema = z.object({
    token: z.string().length(6, "Your one-time password must be 6 characters."),
    authRequestId: z.string(),
});

export async function verifyMfa(data: z.infer<typeof mfaSchema>): Promise<{ success: boolean; error?: string }> {
    const validation = mfaSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.token?.[0] };
    }

    const { token, authRequestId } = validation.data;
    
    const request = await getAuthRequest(authRequestId);
    if (!request || !request.data.accountId) {
        return { success: false, error: 'Your session has expired. Please try again.' };
    }

    const { accountId, status } = request.data;
    if (status !== 'pending_mfa') {
        return { success: false, error: 'Invalid authentication request state.' };
    }

    const totpRef = doc(db, 'auth_totp', accountId);
    const totpDoc = await getDoc(totpRef);

    if (!totpDoc.exists()) {
        return { success: false, error: 'TOTP not enabled for this account.' };
    }

    const encryptedSecret = totpDoc.data().secret;
    const secret = await decrypt(encryptedSecret);

    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';
    
    // Log the activity before creating the session
    await logActivity(accountId, 'Login', 'Success', ipAddress);
    
    // The geolocation is not passed here, so we pass undefined.
    await createAndSetSession(accountId, 'Password + TOTP', ipAddress, userAgent);

    return { success: true };
}