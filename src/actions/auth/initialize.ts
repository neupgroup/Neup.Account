'use server';

import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

const AUTH_REQUEST_EXPIRATION_MINUTES = 7;

async function createAuthRequest(type: 'signup' | 'signin' | 'forgot_password') {
    const requestId = uuidv4();
    const authRequestRef = doc(db, 'auth_requests', requestId);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);

    await setDoc(authRequestRef, {
        type: type,
        status: 'pending',
        data: {},
        createdAt: serverTimestamp(),
        expiresAt: expiresAt,
    });

    return requestId;
}

export async function initializeAuthFlow(
    currentId: string | null,
    flowType: 'signup' | 'signin' | 'forgot_password'
): Promise<string> {
    if (currentId) {
        const authRequestRef = doc(db, 'auth_requests', currentId);
        const authRequestDoc = await getDoc(authRequestRef);

        if (authRequestDoc.exists() && authRequestDoc.data().expiresAt.toDate() > new Date()) {
            const docData = authRequestDoc.data();
            if (docData.type !== flowType) {
                const expiresAt = new Date();
                expiresAt.setMinutes(expiresAt.getMinutes() + AUTH_REQUEST_EXPIRATION_MINUTES);
                // Reset the document for the new flow type
                await updateDoc(authRequestRef, {
                    type: flowType,
                    status: 'pending',
                    data: {}, // Clear previous data
                    accountId: null, // Clear accountId
                    expiresAt: expiresAt,
                });
            }
            return currentId;
        }
    }
    // If no valid currentId, create a new request
    return createAuthRequest(flowType);
}
