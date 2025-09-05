
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { logError } from '@/lib/logger';

export type PaymentDetails = {
    qrCodeUrl?: string;
    bankDetails?: string;
    whatsappContact?: string;
    instagramContact?: string;
    linkedinContact?: string;
};

const DOC_ID = "payment_config"; // Use a fixed ID for the singleton document

export async function getPaymentDetails(): Promise<PaymentDetails | null> {
    try {
        const docRef = doc(db, 'system', DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as PaymentDetails;
        }
        return null;
    } catch (error) {
        await logError('database', error, 'getPaymentDetails');
        return null;
    }
}
