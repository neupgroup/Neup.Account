

'use server';

import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { headers } from 'next/headers';
import { getActiveAccountId } from './auth-actions';

type LogType = 'ai' | 'database' | 'validation' | 'auth' | 'unknown';

export async function logError(type: LogType, error: unknown, context: string = 'No context') {
    let errorMessage: string;
    const ip = headers().get('x-forwarded-for') || 'Unknown IP';
    const accountId = await getActiveAccountId();

    if (error instanceof Error) {
        errorMessage = error.stack || error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        try {
            errorMessage = JSON.stringify(error, null, 2);
        } catch (e) {
            errorMessage = "Could not serialize the error object.";
        }
    }
    
    const logData: { [key: string]: any } = {
        type,
        context,
        message: errorMessage,
        timestamp: serverTimestamp(),
        ipAddress: ip,
        status: 'new' // new, in_progress, solved
    };

    if (accountId) {
        logData.accountId = accountId;
    }

    try {
        await addDoc(collection(db, 'error'), logData);
    } catch (e) {
        // Fallback to console if Firestore logging fails
        console.error("FATAL: Failed to write to Firestore log.", e);
        console.error("Original error:", logData);
    }
}
