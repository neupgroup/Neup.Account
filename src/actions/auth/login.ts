'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createAndSetSession } from '@/lib/session';
import { validateNeupId } from '@/lib/user';
import { getAuthRequest, extendAuthRequest } from './utils';
import prisma from '@/lib/prisma';

const neupIdSchema = z.object({
    neupId: z.string().min(1, "NeupID is required."),
    authRequestId: z.string(),
});

const passwordSchema = z.object({
    password: z.string().min(1, "Password is required."),
    authRequestId: z.string(),
});

export async function submitNeupId(data: z.infer<typeof neupIdSchema>) {
    const validation = neupIdSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: 'Invalid input.' };
    }

    const { neupId, authRequestId } = validation.data;
    const lowerCaseNeupId = neupId.toLowerCase();

    const request = await getAuthRequest(authRequestId);
    if (!request) {
        return { success: false, error: 'Your session has expired. Please try again.' };
    }

    const validationResult = await validateNeupId(lowerCaseNeupId);
    if (!validationResult.success && validationResult.error !== 'pending_deletion') {
        return { success: false, error: validationResult.error || 'Invalid NeupID.' };
    }

    // Map NeupID to accountId via Prisma instead of Firebase
    const neupIdRecord = await prisma.neupId.findUnique({
        where: { id: lowerCaseNeupId },
    });
    const accountId = neupIdRecord?.accountId;

    if (!accountId) {
        return { success: false, error: "Account mapping is missing." };
    }

    await updateDoc(request.ref, {
        'data.neupId': lowerCaseNeupId,
        'data.isPendingDeletion': validationResult.error === 'pending_deletion',
        accountId: accountId,
        status: 'pending_password',
    });

    await extendAuthRequest(request.ref);

    // Fetch user details to return to client for session storage optimization
    const { getUserProfile, getUserContacts } = await import('@/lib/user');
    const profile = await getUserProfile(accountId);
    const contacts = await getUserContacts(accountId);

    return {
        success: true,
        userInfo: {
            neupId: lowerCaseNeupId,
            firstName: profile?.nameFirst || '',
            middleName: profile?.nameMiddle || '',
            lastName: profile?.nameLast || '',
            phoneNumber: contacts.primaryPhone || '',
        }
    };
}


export async function submitPassword(data: z.infer<typeof passwordSchema>): Promise<{ success: boolean; mfaRequired: boolean; error?: string; isPendingDeletion?: boolean }> {
    const validation = passwordSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, mfaRequired: false, error: 'Invalid input.' };
    }

    const { password, authRequestId } = validation.data;

    const request = await getAuthRequest(authRequestId);
    if (!request || !request.data.accountId) {
        return { success: false, mfaRequired: false, error: 'Your session has expired. Please try again.' };
    }

    const { accountId, data: { isPendingDeletion } } = request.data;

    // Verify password using Prisma instead of Firebase
    const passwordRecord = await prisma.password.findUnique({
        where: { accountId },
    });
    if (!passwordRecord) {
        return { success: false, mfaRequired: false, error: "Invalid credentials." };
    }

    const isMatch = await bcrypt.compare(password, passwordRecord.hash);
    if (!isMatch) {
        return { success: false, mfaRequired: false, error: "Invalid credentials." };
    }

    if (isPendingDeletion) {
        return { success: true, mfaRequired: false, isPendingDeletion: true };
    }

    const totpRef = doc(db, 'auth_totp', accountId);
    const totpDoc = await getDoc(totpRef);

    if (totpDoc.exists()) {
        await updateDoc(request.ref, {
            status: 'pending_mfa',
        });
        await extendAuthRequest(request.ref);
        return { success: true, mfaRequired: true };
    } else {
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
        const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

        // The geolocation is not passed here, so we pass undefined.
        await createAndSetSession(accountId, 'Password', ipAddress, userAgent);

        await updateDoc(request.ref, { status: 'completed' });

        return { success: true, mfaRequired: false };
    }
}
