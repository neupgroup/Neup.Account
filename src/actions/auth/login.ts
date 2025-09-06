
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cookies, headers } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { loginFormSchema } from '@/schemas/auth';
import { createAndSetSession } from '@/lib/session';

const THREE_MINUTES_IN_MS = 3 * 60 * 1000;

export async function initiateLogin(data: z.infer<typeof loginFormSchema>): Promise<{ success: boolean; mfaRequired: boolean; error?: string }> {
    const validation = loginFormSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, mfaRequired: false, error: 'Invalid input.' };
    }

    const { neupId, password } = validation.data;
    const lowerCaseNeupId = neupId.toLowerCase();

    const neupIdRef = doc(db, 'neupid', lowerCaseNeupId);
    const neupIdDoc = await getDoc(neupIdRef);

    if (!neupIdDoc.exists()) {
        return { success: false, mfaRequired: false, error: "Invalid credentials." };
    }

    const accountId = neupIdDoc.data().for;
    if (!accountId) {
        return { success: false, mfaRequired: false, error: "Account mapping is missing." };
    }

    const authRef = doc(db, 'auth_password', accountId);
    const authDoc = await getDoc(authRef);
    if (!authDoc.exists()) {
        return { success: false, mfaRequired: false, error: "Invalid credentials." };
    }

    const isMatch = await bcrypt.compare(password, authDoc.data().pass);
    if (!isMatch) {
        return { success: false, mfaRequired: false, error: "Invalid credentials." };
    }

    const totpRef = doc(db, 'auth_totp', accountId);
    const totpDoc = await getDoc(totpRef);
    
    const requestId = uuidv4();
    const authRequestRef = doc(db, 'auth_requests', requestId);

    if (totpDoc.exists()) {
        await setDoc(authRequestRef, {
            accountId,
            type: 'signin',
            status: 'pending_mfa',
            data: {
                neupid: lowerCaseNeupId,
                password: 'authenticated',
            },
            createdAt: serverTimestamp(),
            expiresAt: new Date(Date.now() + THREE_MINUTES_IN_MS),
        });

        cookies().set('temp_auth_id', requestId, { httpOnly: true, secure: true, maxAge: 180 });

        return { success: true, mfaRequired: true };
    } else {
        const headersList = headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
        const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';
        
        // The geolocation is not passed here, so we pass undefined.
        await createAndSetSession(accountId, 'Password', ipAddress, userAgent);

        return { success: true, mfaRequired: false };
    }
}
