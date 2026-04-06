
'use server';

import path from 'path';
import { promises as fs } from 'fs';

export type AppInfo = {
    name: string;
    version: string;
    description: string;
    whatsappContact?: string;
    instagramContact?: string;
    linkedinContact?: string;
};

export type PaymentDetails = {
    qrCodeUrl?: string;
    bankDetails?: string;
};

export async function getAppInfo(): Promise<AppInfo | null> {
    try {
        const filePath = path.join(process.cwd(), 'base/config/appInfo.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent) as AppInfo;
    } catch (error) {
        console.error('Error reading app info:', error);
        return null;
    }
}

export async function getPaymentDetails(): Promise<PaymentDetails | null> {
    try {
        const filePath = path.join(process.cwd(), 'base/config/payInfo.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent) as PaymentDetails;
    } catch (error) {
        console.error('Error reading payment details:', error);
        return null;
    }
}
