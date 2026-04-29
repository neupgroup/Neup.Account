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

	const session = await prisma.authSession.findUnique({
		where: { id: sid },
		select: { accountId: true, key: true, validTill: true },
	});

	if (!session || session.accountId !== aid || session.key !== skey) {
		return { status: 'unauthorized' };
	}

	if (!session.validTill || session.validTill <= new Date()) {
		return { status: 'expired' };
	}

	const decoded = jwt.decode(token) as null | { [key: string]: any };
	const decodedAppId = decoded && typeof decoded === 'object' ? (decoded.appId as string | undefined) : undefined;
	if (!decodedAppId) return { status: 'unauthorized' };

	const [application, connection] = await Promise.all([
		prisma.application.findUnique({
			where: { id: decodedAppId },
			select: { appSecret: true },
		}),
		prisma.applicationConnection.findUnique({
			where: {
				accountId_appId: {
					accountId: aid,
					appId: decodedAppId,
				},
			},
			select: { id: true },
		}),
	]);
	const appSecret = application?.appSecret;
	if (!appSecret || !connection) {
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

		if (payload?.appId && payload.appId !== decodedAppId) {
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
	const { accountId, sessionId, sessionKey } = await authCookies.getSessionCookies();
	const token = (await authCookies.get('auth_jwt')) || '';

	return validateJwt({
		aid: accountId || '',
		sid: sessionId || '',
		skey: sessionKey || '',
		jwt: token,
	});
}
