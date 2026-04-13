"use server";

import jwt, { TokenExpiredError } from 'jsonwebtoken';
import prisma from '@/core/helpers/prisma';
import { authCookies } from '@/core/helpers/cookies';



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

	const appSession = await prisma.authSession.findFirst({
		where: {
			id: sid,
			accountId: aid,
			authSessionKey: skey,
			applicationType: 'external',
			isExpired: false,
		},
		select: {
			accountId: true,
			expiresOn: true,
			application: true,
		},
	});

	if (!appSession) {
		return { status: 'unauthorized' };
	}

	if (!appSession.expiresOn || appSession.expiresOn <= new Date()) {
		return { status: 'expired' };
	}

	const application = appSession.application
		? await prisma.application.findUnique({
				where: { id: appSession.application },
				select: { appSecret: true },
		  })
		: null;
	const appSecret = application?.appSecret;
	if (!appSecret) {
		return { status: 'unauthorized' };
	}

	try {
		const payload = jwt.verify(token, appSecret) as { aid?: string; sid?: string; appId?: string };

		if (payload?.aid && payload.aid !== aid) {
			return { status: 'invalid' };
		}

		if (payload?.sid && payload.sid !== sid) {
			return { status: 'invalid' };
		}

		if (payload?.appId && payload.appId !== appSession.application) {
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
	const aid = (await authCookies.get('aid')) || (await authCookies.get('auth_aid')) || '';
	const sid = (await authCookies.get('sid')) || (await authCookies.get('auth_sid')) || '';
	const skey = (await authCookies.get('skey')) || (await authCookies.get('auth_skey')) || '';
	const token = (await authCookies.get('jwt')) || (await authCookies.get('auth_jwt')) || '';

	return validateJwt({
		aid,
		sid,
		skey,
		jwt: token,
	});
}