
'use server';

import prisma from '@/lib/prisma';
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
        const config = await prisma.systemConfig.findUnique({
            where: { id: DOC_ID }
        });

        if (config) {
            return config.data as PaymentDetails;
        }
        return null;
    } catch (error) {
        await logError('database', error, 'getPaymentDetails');
        return null;
    }
}
