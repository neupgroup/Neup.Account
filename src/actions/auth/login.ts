
'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logActivity } from '@/lib/log-actions';
import { headers } from 'next/headers';
import { createAndSetSession, validateNeupId } from './session';
import { logError } from '@/lib/logger';

const loginFormSchema = z.object({
    neupId: z.string().min(1, "NeupID is required."),
    password: z.string().min(1, "Password is required."),
    geolocation: z.string().optional(),
});

export async function loginUser(data: z.infer<typeof loginFormSchema>) {
    const validation = loginFormSchema.safeParse(data);
    if (!validation.success) { return { success: false, error: "Invalid data provided." }; }
    
    const neupId = data.neupId.toLowerCase();
    const { password, geolocation } = validation.data;
    
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
    const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

    try {
        const neupidsRef = doc(db, 'neupid', neupId);
        const neupidsSnapshot = await getDoc(neupidsRef);

        if (!neupidsSnapshot.exists()) {
            await logActivity('unknown', `Login Attempt Failed for NeupID: ${neupId}`, 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        const accountId = neupidsSnapshot.data().for;
        const passRef = doc(db, 'auth_password', accountId);
        const passDoc = await getDoc(passRef);

        if (!passDoc.exists()) {
             await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Authentication data not found.' };
        }
        const isMatch = await bcrypt.compare(password, passDoc.data().pass);
        if (!isMatch) {
            await logActivity(accountId, 'Login Attempt Failed', 'Failed', ipAddress, undefined, geolocation);
            return { success: false, error: 'Invalid NeupID or password.' };
        }
        
        await logActivity(accountId, 'Login', 'Success', ipAddress, undefined, geolocation);
        await createAndSetSession(accountId, 'Password', ipAddress, userAgent, geolocation);

        return { success: true };
    } catch (error) {
        await logError('database', error, 'loginUser');
        return { success: false, error: 'An unexpected error occurred.' };
    }
}
