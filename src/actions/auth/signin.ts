
'use server';

import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { createAndSetSession } from '@/lib/session';
import { logError } from '@/lib/logger';
import { validateNeupId } from '@/lib/user';
import { loginFormSchema } from '@/schemas/auth';
import { createNotification } from '@/actions/notifications';


export async function loginUser(data: z.infer<typeof loginFormSchema>) {
    const validation = loginFormSchema.safeParse(data);
    if (!validation.success) { return { success: false, error: "Invalid data provided." }; }
    
    const neupId = data.neupId.toLowerCase();
    const { password, geolocation } = validation.data;
    
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

    try {
        const neupIdDoc = await prisma.neupId.findUnique({
            where: { id: neupId },
        });

        if (!neupIdDoc) {
            await logActivity('unknown', `Login Attempt Failed for NeupID: ${neupId}`, 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        const accountId = neupIdDoc.accountId;
        
        const validationResult = await validateNeupId(neupId);
        if(validationResult.success === false && validationResult.error !== 'pending_deletion') {
            await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return validationResult;
        }

        const passwordDoc = await prisma.password.findUnique({
            where: { accountId: accountId },
        });

        if (!passwordDoc) {
             await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Authentication data not found.' };
        }
        const isMatch = await bcrypt.compare(password, passwordDoc.hash);
        if (!isMatch) {
            await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        // After password is confirmed, check for pending deletion
        if (validationResult.error === 'pending_deletion') {
            return { success: false, error: 'pending_deletion' };
        }

        await logActivity(accountId, 'Login', 'Success', ipAddress, undefined, geolocation);
        await createAndSetSession(accountId, 'Password', ipAddress, userAgent, geolocation);
        await createNotification({
            recipient_id: accountId,
            action: 'informative.login',
            message: `Your account was signed in from a new device.`,
        });


        return { success: true };
    } catch (error) {
        await logError('database', error, 'loginUser');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
