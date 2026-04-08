"use server";

import { headers } from 'next/headers';
import { authenticator } from 'otplib';
import { z } from 'zod';
import prisma from '@/core/helpers/prisma';
import { decrypt } from '@/services/security/totp';
import { createAndSetSession } from '@/core/helpers/session';
import { logActivity } from '@/core/helpers/log-actions';
import { getAuthRequest } from './utils';



/**
 * Result returned by TOTP validation helpers.
 */
export type TotpVerificationResult = {
	success: boolean;
	error?: string;
};



/**
 * Input for direct TOTP verification.
 */
export type VerifyTotpInput = {
	accountId: string;
	token: string;
};



/**
 * Input for MFA flow verification.
 */
export type VerifyTotpFromRequestInput = {
	authRequestId: string;
	token: string;
};



const verifyTotpRequestSchema = z.object({
	token: z.string().length(6, 'Your one-time password must be 6 characters.'),
	authRequestId: z.string().min(1),
});



/**
 * Verifies a TOTP token for a specific account.
 */
export async function verifyTotp(input: VerifyTotpInput): Promise<TotpVerificationResult> {
	const { accountId, token } = input;

	if (!accountId || !token) {
		return { success: false, error: 'Missing authentication data.' };
	}

	const totp = await prisma.totp.findUnique({
		where: { accountId },
	});

	if (!totp) {
		return { success: false, error: 'TOTP not enabled for this account.' };
	}

	try {
		const secret = await decrypt(totp.secret);
		const isValid = authenticator.verify({ token, secret });

		if (!isValid) {
			return { success: false, error: 'Invalid token. Please check your device time and try again.' };
		}

		return { success: true };
	} catch {
		return { success: false, error: 'Could not verify TOTP.' };
	}
}



/**
 * Verifies a TOTP token from a POST body or a request-like payload and completes sign-in.
 */
export async function verifyTotpFromPost(
	input: Request | VerifyTotpFromRequestInput
): Promise<TotpVerificationResult> {
	const payload = input instanceof Request ? await input.json() : input;
	const validation = verifyTotpRequestSchema.safeParse(payload);

	if (!validation.success) {
		return { success: false, error: validation.error.flatten().fieldErrors.token?.[0] };
	}

	const { token, authRequestId } = validation.data;
	const request = await getAuthRequest(authRequestId);

	if (!request || !request.data.accountId) {
		return { success: false, error: 'Your session has expired. Please try again.' };
	}

	const accountId = request.data.accountId;
	const status = request.data.status;
	if (!accountId || status !== 'pending_mfa') {
		return { success: false, error: 'Invalid authentication request state.' };
	}

	const verification = await verifyTotp({ accountId, token });
	if (!verification.success) {
		return verification;
	}

	const headersList = await headers();
	const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
	const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

	await logActivity(accountId, 'Login', 'Success', ipAddress);
	await createAndSetSession(accountId, 'Password + TOTP', ipAddress, userAgent);

	return { success: true };
}



/**
 * Verifies a TOTP token from a FormData submission and completes sign-in.
 */
export async function verifyTotpFromForm(formData: FormData): Promise<TotpVerificationResult> {
	const token = formData.get('token');
	const authRequestId = formData.get('authRequestId');

	return verifyTotpFromPost({
		token: typeof token === 'string' ? token : '',
		authRequestId: typeof authRequestId === 'string' ? authRequestId : '',
	});
}