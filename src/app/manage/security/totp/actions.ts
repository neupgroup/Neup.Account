

'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection } from 'firebase/firestore';
import { getActiveAccountId } from '@/lib/auth-actions';
import { getUserNeupIds, checkPermissions } from '@/lib/user-actions';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/log-actions';
import { logError } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

// We need a consistent secret for encryption. STORE THIS IN A SECURE VAULT.
// For this example, it's in an environment variable.
const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
    throw new Error('A 32-byte (64-character hex) TOTP_ENCRYPTION_KEY must be set in .env');
}

// Basic encryption/decryption functions using Node.js crypto
// In a production app, use a dedicated KMS for this.
async function encrypt(text: string): Promise<string> {
    const { subtle } = await import('crypto');
    const key = await subtle.importKey('raw', Buffer.from(ENCRYPTION_KEY, 'hex'), { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.randomBytes(12);
    const encoded = new TextEncoder().encode(text);
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return `${iv.toString('hex')}:${Buffer.from(encrypted).toString('hex')}`;
}

async function decrypt(encryptedText: string): Promise<string> {
    const { subtle } = await import('crypto');
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex) throw new Error('Invalid encrypted text format');
    
    const key = await subtle.importKey('raw', Buffer.from(ENCRYPTION_KEY, 'hex'), { name: 'AES-GCM' }, false, ['decrypt']);
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    
    const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
    return new TextDecoder().decode(decrypted);
}


// Check if TOTP is enabled for the current user
export async function getTotpStatus(): Promise<{ isEnabled: boolean }> {
    const accountId = await getActiveAccountId();
    if (!accountId) return { isEnabled: false };

    const totpRef = doc(db, 'auth_totp', accountId);
    const totpDoc = await getDoc(totpRef);

    return { isEnabled: totpDoc.exists() };
}

// Generate a new secret and QR code for setup
export async function generateTotpSecret(): Promise<{ secret: string; qrCodeUrl: string }> {
    const accountId = await getActiveAccountId();
    if (!accountId) throw new Error('User not authenticated');

    const neupIds = await getUserNeupIds(accountId);
    const neupId = neupIds[0] || accountId;

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(neupId, 'NeupID', secret);

    const qrCodeUrl = await qrcode.toDataURL(otpAuthUrl);

    return { secret, qrCodeUrl };
}

// Verify the token and enable TOTP
const enableSchema = z.object({
    secret: z.string(),
    token: z.string().length(6, "Token must be 6 digits."),
});
export async function verifyAndEnableTotp(data: { secret: string, token: string }): Promise<{ success: boolean; error?: string }> {
    const canAdd = await checkPermissions(['security.totp.add']);
    if (!canAdd) return { success: false, error: 'Permission denied.' };

    const validation = enableSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.token?.[0] };
    }
    
    const { secret, token } = validation.data;
    const accountId = await getActiveAccountId();
    if (!accountId) return { success: false, error: 'User not authenticated' };
    
    const isValid = authenticator.check(token, secret, {
        window: 4, // Allow a 2-minute time drift (4 steps * 30 seconds)
    });
    
    if (!isValid) {
        return { success: false, error: 'Invalid token. Please check your device time and try again.' };
    }

    try {
        const encryptedSecret = await encrypt(secret);
        const totpRef = doc(db, 'auth_totp', accountId);
        await setDoc(totpRef, { secret: encryptedSecret, createdAt: serverTimestamp() });
        await logActivity(accountId, 'TOTP Enabled', 'Success');
        return { success: true };
    } catch(error) {
        await logError('database', error, `verifyAndEnableTotp: ${accountId}`);
        return { success: false, error: 'Could not enable TOTP.' };
    }
}


// Disable TOTP for the user
const disableSchema = z.object({
    password: z.string().min(1, "Password is required."),
});
export async function disableTotp(data: { password: string }): Promise<{ success: boolean; error?: string }> {
    const canRemove = await checkPermissions(['security.totp.remove']);
    if (!canRemove) return { success: false, error: 'Permission denied.' };
    
    const validation = disableSchema.safeParse(data);
    if (!validation.success) {
        return { success: false, error: validation.error.flatten().fieldErrors.password?.[0] };
    }
    const { password } = validation.data;
    const accountId = await getActiveAccountId();
    if (!accountId) return { success: false, error: 'User not authenticated' };

    try {
        // 1. Verify password
        const authRef = doc(db, 'auth_password', accountId);
        const authDoc = await getDoc(authRef);
        if (!authDoc.exists()) {
            return { success: false, error: "Authentication data not found." };
        }
        const isMatch = await bcrypt.compare(password, authDoc.data().pass);
        if (!isMatch) {
            await logActivity(accountId, 'TOTP Disable Failed', 'Failed');
            return { success: false, error: "The password you entered is incorrect." };
        }

        // 2. Delete TOTP secret
        const totpRef = doc(db, 'auth_totp', accountId);
        await deleteDoc(totpRef);

        await logActivity(accountId, 'TOTP Disabled', 'Success');
        return { success: true };

    } catch(error) {
        await logError('database', error, `disableTotp: ${accountId}`);
        return { success: false, error: 'Could not disable TOTP.' };
    }
}

// Gets the current server time
export async function getServerTime(): Promise<string> {
    return new Date().toISOString();
}
