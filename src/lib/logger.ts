'use server';

import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { headers } from 'next/headers';
import { getActiveAccountId } from './auth-actions';
import crypto from 'crypto';

type LogType = 'ai' | 'database' | 'validation' | 'auth' | 'unknown';
type ReportType = 'auto' | 'submitted';

export async function logError(
    type: LogType, 
    error: unknown, 
    context: string = 'No context',
    reportType: ReportType = 'auto'
) {
    let errorMessage: string;
    const ip = (await headers()).get('x-forwarded-for') || 'Unknown IP';
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
    
    // Create a consistent signature for the error
    const firstLine = errorMessage.split('\n')[0];
    const signature = crypto.createHash('md5').update(`${type}:${firstLine}`).digest('hex');

    try {
        const errorCollection = collection(db, 'error');
        const q = query(errorCollection, where('signature', '==', signature), where('status', '==', 'new'));
        const existingErrors = await getDocs(q);

        if (!existingErrors.empty) {
            // Found an existing error, so we'll update it.
            const errorDoc = existingErrors.docs[0];
            await updateDoc(errorDoc.ref, {
                count: increment(1),
                lastSeen: serverTimestamp(),
                contexts: { [context]: serverTimestamp() } // Using a map to avoid duplicates and track last seen
            });

        } else {
            // No existing error found, create a new one.
            const logData: { [key: string]: any } = {
                type,
                reportType,
                message: errorMessage,
                signature,
                count: 1,
                firstSeen: serverTimestamp(),
                lastSeen: serverTimestamp(),
                contexts: { [context]: serverTimestamp() },
                status: 'new', // new, in_progress, solved
                ipAddress: ip,
            };

            if (accountId) {
                logData.reported_by = accountId;
            }

            await addDoc(errorCollection, logData);
        }

    } catch (e) {
        // Fallback to console if Firestore logging fails
        console.error("FATAL: Failed to write to Firestore log.", e);
        console.error("Original error:", {
            type,
            context,
            message: errorMessage,
            signature,
            ip,
            accountId
        });
    }
}
