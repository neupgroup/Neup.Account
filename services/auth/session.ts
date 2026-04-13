"use server";

import { headers } from 'next/headers';
import prisma from '@/core/helpers/prisma';
import { createAndSetSession } from '@/core/helpers/session';
import { authCookies } from '@/core/helpers/cookies';
import { getActiveSession } from '@/core/helpers/session';
import { makeNotification } from '@/services/notifications';

/**
 * Reasons returned when auth validation fails.
 */
type AuthValidationReason = '404' | 'accountBlocked' | 'invalidSource';


/**
 * Standard response shape for auth validation.
 */
export type AuthValidationResult =
	| {
		status: 'valid';
		validTill: string;
	}
	| {
		status: 'invalid' | 'expired';
		reason?: AuthValidationReason;
	};


/**
 * Inputs required to validate a session without reading cookies.
 */
export type ValidateAuthSessionInput = {
	auth_aid: string;
	auth_sid: string;
	auth_skey: string;
};


/**
 * Standard response returned after expiring a session.
 */
export type ExpireSessionResult = {
	success: boolean;
	error?: string;
};


/**
 * Inputs required to expire a session.
 */
export type ExpireSessionInput = {
	aid: string;
	sid: string;
	skey: string;
};


/**
 * Input required to create a session.
 */
export type MakeSessionInput = {
	accountId: string;
	loginType: string;
	geolocation?: string;
};


/**
 * Standard response returned by session creation helper.
 */
export type MakeSessionResult = {
	success: boolean;
	error?: string;
};


/**
 * Type BridgeAuthSessionError.
 */
export type BridgeAuthSessionError = {
	error: string;
	error_description?: string;
};


/**
 * Minimal block metadata used to determine whether an account is blocked.
 */
type BlockInfo = {
	is_permanent?: boolean;
	until?: string | Date;
} | null;


/**
 * Returns true when a block is currently active.
 */
function hasActiveBlock(block: BlockInfo, now: Date): boolean {
	if (!block) return false;

	if (block.is_permanent) return true;

	if (block.until) {
		return new Date(block.until) > now;
	}

	return false;
}


/**
 * Validates the provided auth session values against the database.
 */
export async function validateAuthSession(input: ValidateAuthSessionInput): Promise<AuthValidationResult> {
	const { auth_aid, auth_sid, auth_skey } = input;

	if (!auth_aid || !auth_sid || !auth_skey) {
		return {
			status: 'invalid',
			reason: 'invalidSource',
		};
	}

	const session = await prisma.authSession.findUnique({
		where: { id: auth_sid },
		select: {
			accountId: true,
			authSessionKey: true,
			expiresOn: true,
			isExpired: true,
		},
	});

	if (!session) {
		return {
			status: 'invalid',
			reason: '404',
		};
	}

	if (session.accountId !== auth_aid || session.authSessionKey !== auth_skey) {
		return {
			status: 'invalid',
			reason: 'invalidSource',
		};
	}

	const now = new Date();
	const expiresOn = session.expiresOn;

	if (session.isExpired || !expiresOn || expiresOn <= now) {
		return {
			status: 'expired',
		};
	}

	const account = await prisma.account.findUnique({
		where: { id: auth_aid },
		select: {
			id: true,
			status: true,
			details: true,
		},
	});

	if (!account) {
		return {
			status: 'invalid',
			reason: '404',
		};
	}

	const details = account.details as Record<string, unknown> | null;
	const block = (details?.block as BlockInfo) || null;

	if (account.status === 'blocked' && hasActiveBlock(block, now)) {
		return {
			status: 'invalid',
			reason: 'accountBlocked',
		};
	}

	return {
		status: 'valid',
		validTill: expiresOn.toISOString(),
	};
}


/**
 * Reads auth cookies and validates them using validateAuthSession().
 */
export async function validateAuthSessionFromCookies(): Promise<AuthValidationResult> {
	return validateAuthSession({
		auth_aid: (await authCookies.get('auth_aid')) || '',
		auth_sid: (await authCookies.get('auth_sid')) || '',
		auth_skey: (await authCookies.get('auth_skey')) || '',
	});
}


/**
 * Marks a session as expired in the database.
 */
export async function expireSession(input: ExpireSessionInput): Promise<ExpireSessionResult> {
	const aid = input.aid?.trim();
	const sid = input.sid?.trim();
	const skey = input.skey?.trim();

	if (!aid || !sid || !skey) {
		return { success: false, error: 'Missing session details.' };
	}

	try {
		const session = await prisma.authSession.findUnique({
			where: { id: sid },
			select: {
				accountId: true,
				authSessionKey: true,
			},
		});

		if (!session) {
			return { success: false, error: 'Session not found.' };
		}

		if (session.accountId !== aid || session.authSessionKey !== skey) {
			return { success: false, error: 'Invalid session.' };
		}

		await prisma.authSession.update({
			where: { id: sid },
			data: {
				isExpired: true,
				expiresOn: new Date(),
			},
		});

		await makeNotification({
			recipient_id: aid,
			action: 'informative.logout',
			message: 'You recently logged out from a device.',
		});

		return { success: true };
	} catch {
		return { success: false, error: 'Failed to expire session.' };
	}
}


/**
 * Reads the active auth cookies and expires the matching session.
 */
export async function expireSessionFromCookies(): Promise<ExpireSessionResult> {
	return expireSession({
		aid: (await authCookies.get('auth_aid')) || (await authCookies.get('aid')) || '',
		sid: (await authCookies.get('auth_sid')) || (await authCookies.get('sid')) || '',
		skey: (await authCookies.get('auth_skey')) || (await authCookies.get('skey')) || '',
	});
}


/**
 * Creates a session using the current request headers for device context.
 */
export async function makeSession(input: MakeSessionInput): Promise<MakeSessionResult> {
	const accountId = input.accountId?.trim();
	const loginType = input.loginType?.trim();

	if (!accountId || !loginType) {
		return { success: false, error: 'Missing accountId or loginType.' };
	}

	try {
		const headersList = await headers();
		const ipAddress = headersList.get('x-forwarded-for') || 'Unknown IP';
		const userAgent = headersList.get('user-agent') || 'Unknown User-Agent';

		await createAndSetSession(accountId, loginType, ipAddress, userAgent, input.geolocation);
		await makeNotification({
			recipient_id: accountId,
			action: 'informative.login',
			message: 'You recently signed in from a new device.',
		});

		return { success: true };
	} catch {
		return { success: false, error: 'Failed to create session.' };
	}
}


/**
 * Function bridgeValidateAndRefreshSession.
 */
export async function bridgeValidateAndRefreshSession(input: {
	aid?: string;
	sid?: string;
	skey?: string;
	deviceType?: string;
	activity?: string;
}): Promise<{ status: number; body: BridgeAuthSessionError | { success: true; session: { aid: string; sid: string; expiresOn: Date | null; deviceType: string | null } } }> {
	const { aid, sid, skey, deviceType } = input;

	if (!aid || !sid || !skey) {
		return {
			status: 400,
			body: { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
		};
	}

	try {
		const session = await prisma.authSession.findUnique({
			where: { id: sid },
			include: { account: true },
		});

		if (!session || session.accountId !== aid || session.authSessionKey !== skey || session.isExpired) {
			return {
				status: 401,
				body: { error: 'invalid_session', error_description: 'Session not found or invalid' },
			};
		}

		if (session.expiresOn && session.expiresOn < new Date()) {
			return {
				status: 401,
				body: { error: 'session_expired', error_description: 'Session has expired' },
			};
		}

		const newExpiry = new Date();
		newExpiry.setDate(newExpiry.getDate() + 30);

		const updatedSession = await prisma.authSession.update({
			where: { id: sid },
			data: {
				expiresOn: newExpiry,
				...(deviceType ? { deviceType } : {}),
			},
		});

		return {
			status: 200,
			body: {
				success: true,
				session: {
					aid: updatedSession.accountId,
					sid: updatedSession.id,
					expiresOn: updatedSession.expiresOn,
					deviceType: updatedSession.deviceType,
				},
			},
		};
	} catch (error) {
		return { status: 500, body: { error: 'internal_server_error' } };
	}
}


/**
 * Function bridgeInvalidateSession.
 */
export async function bridgeInvalidateSession(input: {
	aid?: string;
	sid?: string;
	skey?: string;
}): Promise<{ status: number; body: BridgeAuthSessionError | { success: true; message: string } }> {
	const { aid, sid, skey } = input;

	if (!aid || !sid || !skey) {
		return {
			status: 400,
			body: { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
		};
	}

	try {
		const session = await prisma.authSession.updateMany({
			where: {
				id: sid,
				accountId: aid,
				authSessionKey: skey,
			},
			data: {
				isExpired: true,
				expiresOn: new Date(),
			},
		});

		if (session.count === 0) {
			return {
				status: 404,
				body: { error: 'not_found', error_description: 'Session not found' },
			};
		}

		return { status: 200, body: { success: true, message: 'Session invalidated' } };
	} catch (error) {
		return { status: 500, body: { error: 'internal_server_error' } };
	}
}


/**
 * Function bridgeRefreshSessionExpiry.
 */
export async function bridgeRefreshSessionExpiry(): Promise<{ status: number; body: { success: boolean; error?: string; newExpiresOn?: string } }> {
	try {
		const session = await getActiveSession();

		if (!session) {
			return { status: 401, body: { success: false, error: 'Unauthenticated.' } };
		}

		const newExpiresOn = new Date();
		newExpiresOn.setDate(newExpiresOn.getDate() + 30);

		await prisma.authSession.update({
			where: { id: session.sessionId },
			data: { expiresOn: newExpiresOn },
		});

		return { status: 200, body: { success: true, newExpiresOn: newExpiresOn.toISOString() } };
	} catch {
		return { status: 500, body: { success: false, error: 'Internal server error.' } };
	}
}