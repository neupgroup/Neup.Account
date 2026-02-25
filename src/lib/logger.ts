'use server';

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
        } catch {
            errorMessage = "Could not serialize the error object.";
        }
    }
    
    const firstLine = errorMessage.split('\n')[0];
    const signature = crypto.createHash('md5').update(`${type}:${firstLine}`).digest('hex');

    // Console-based logging fallback to remove Firebase dependency.
    // This preserves visibility while the database-backed error store is introduced.
    // Consumers await this function for side effects only.
    // You can later route this to Prisma if/when an ErrorLog model is added.
    // eslint-disable-next-line no-console
    console.error("ERROR", {
        type,
        reportType,
        context,
        message: errorMessage,
        signature,
        ip,
        accountId,
        timestamp: new Date().toISOString(),
    });
}
