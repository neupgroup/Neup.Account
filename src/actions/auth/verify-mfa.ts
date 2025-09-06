'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { cookies, headers } from 'next/headers';
import { authenticator } from 'otplib';
import { decrypt } from '@/actions/security/totp';
import { z } from 'zod';
import { createAndSetSession } from '@/lib/session';

const mfaSchema = z.object({
    token: z.string().length(6, "Your one-time password must be 6 characters."),
});

export async function verifyMfa(data: z.infer<typeof mfaSchema>): Promise<{ success: boolean; error?: string }> {
    const validation = mfaSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.token?.[0] };
    }

    const { token } = validation.data;
    const tempAuthId = cookies().get('temp_auth_id')?.value;

    if (!tempAuthId) {
        return { success: false, error: 'Authentication request not found. Please try again.' };
    }

    const authRequestRef = doc(db, 'authentication_requests', tempAuthId);
    const authRequestDoc = await getDoc(authRequestRef);

    if (!authRequestDoc.exists() || authRequestDoc.data().expiresAt.toDate() < new Date()) {
        cookies().delete('temp_auth_id');
        return { success: false, error: 'Authentication request expired. Please try again.' };
    }

    const { accountId, status } = authRequestDoc.data();

    if (status !== 'pending_mfa') {
        return { success: false, error: 'Invalid authentication request.' };
    }

    const totpRef = doc(db, 'auth_totp', accountId);
    const totpDoc = await getDoc(totpRef);

    if (!totpDoc.exists()) {
        return { success: false, error: 'TOTP not enabled for this account.' };
    }

    const encryptedSecret = totpDoc.data().secret;
    const secret = await decrypt(encryptedSecret);

    const isValid = authenticator.check(token, secret, {
        window: 4, // Allow a 2-minute time drift (4 steps * 30 seconds)
    });

    if (!isValid) {
        return { success: false, error: 'Invalid one-time password.' };
    }

    // MFA successful, update the request and create the user session
    await updateDoc(authRequestRef, { status: 'completed' });
    cookies().delete('temp_auth_id');

    const headersList = headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';
    
    // The geolocation is not passed here, so we pass undefined.
    await createAndSetSession(accountId, 'Password + TOTP', ipAddress, userAgent);

    return { success: true };
}
