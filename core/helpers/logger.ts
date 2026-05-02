'use server';

import { headers } from 'next/headers';
import { getActiveAccountId } from '@/core/auth/verify';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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

    const logEntry = {
        type,
        reportType,
        context,
        message: errorMessage,
        signature,
        ip,
        accountId,
        timestamp: new Date().toISOString(),
    };

    // Console-based logging fallback
    // eslint-disable-next-line no-console
    console.error("ERROR", logEntry);

    // File-based logging to /core/logs/error.log
    try {
        const logFilePath = path.join(process.cwd(), 'core', 'logs', 'error.log');
        const logDir = path.dirname(logFilePath);
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const logString = `[${logEntry.timestamp}] [${type}] [${reportType}] [${context}] [IP: ${ip}] [Account: ${accountId}] [Signature: ${signature}]\nMessage: ${errorMessage}\n${'-'.repeat(80)}\n`;
        
        fs.appendFileSync(logFilePath, logString, 'utf8');
    } catch (fileError) {
        // eslint-disable-next-line no-console
        console.error("CRITICAL: Could not write to error log file.", fileError);
    }
}
