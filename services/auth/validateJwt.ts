"use server";

import { cookies } from 'next/headers';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import prisma from '@/core/helpers/prisma';



/**
 * Status returned by JWT validation.
 */
export type JwtValidationStatus = 'expired' | 'invalid' | 'valid' | 'unauthorized';



/**
 * Standard response for JWT checks.
 */
export type JwtValidationResult = {
	status: JwtValidationStatus;
};



/**
 * Inputs required to validate an external JWT session directly.
 */
export type ValidateJwtInput = {
	aid: string;
	sid: string;
	skey: string;
	jwt: string;
};



/**
 * Validates external auth credentials and JWT.
 */
export async function validateJwt(input: ValidateJwtInput): Promise<JwtValidationResult> {
	const { aid, sid, skey, jwt: token } = input;

	if (!aid || !sid || !skey || !token) {
		return { status: 'unauthorized' };
	}

	const externalSession = await prisma.authSessionExternal.findFirst({
		where: {
			id: sid,
			accountId: aid,
			sessionKey: skey,
		},
		select: {
			accountId: true,
			jwt: true,
			expiresOn: true,
			application: {
				select: {
					appSecret: true,
				},
			},
		},
	});

	if (!externalSession) {
		return { status: 'unauthorized' };
	}

	if (!externalSession.expiresOn || externalSession.expiresOn <= new Date()) {
		return { status: 'expired' };
	}

	if (externalSession.jwt !== token) {
		return { status: 'invalid' };
	}

	const appSecret = externalSession.application?.appSecret;
	if (!appSecret) {
		return { status: 'unauthorized' };
	}

	try {
		const payload = jwt.verify(token, appSecret) as { aid?: string };

		if (payload?.aid && payload.aid !== aid) {
			return { status: 'invalid' };
		}

		return { status: 'valid' };
	} catch (error) {
		if (error instanceof TokenExpiredError) {
			return { status: 'expired' };
		}

		return { status: 'invalid' };
	}
}



/**
 * Reads JWT session values from cookies and validates them.
 */
export async function validateJwtFromCookies(): Promise<JwtValidationResult> {
	const cookieStore = await cookies();

	const aid = cookieStore.get('aid')?.value || cookieStore.get('auth_aid')?.value || '';
	const sid = cookieStore.get('sid')?.value || cookieStore.get('auth_sid')?.value || '';
	const skey = cookieStore.get('skey')?.value || cookieStore.get('auth_skey')?.value || '';
	const token = cookieStore.get('jwt')?.value || cookieStore.get('auth_jwt')?.value || '';

	return validateJwt({
		aid,
		sid,
		skey,
		jwt: token,
	});
}