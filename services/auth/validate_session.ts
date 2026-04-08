"use server";

import { cookies } from 'next/headers';
import prisma from '@/core/helpers/prisma';



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

	const session = await prisma.session.findUnique({
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
			accountStatus: true,
			block: true,
		},
	});

	if (!account) {
		return {
			status: 'invalid',
			reason: '404',
		};
	}

	if (account.accountStatus === 'blocked' && hasActiveBlock(account.block as BlockInfo, now)) {
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
	const cookieStore = await cookies();

	return validateAuthSession({
		auth_aid: cookieStore.get('auth_aid')?.value || '',
		auth_sid: cookieStore.get('auth_sid')?.value || '',
		auth_skey: cookieStore.get('auth_skey')?.value || '',
	});
}
