"use server";

import { cookies } from 'next/headers';
import prisma from '@/core/helpers/prisma';
import { makeNotification } from '@/services/notifications';

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
		const session = await prisma.session.findUnique({
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

		await prisma.session.update({
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
	const cookieStore = await cookies();

	return expireSession({
		aid: cookieStore.get('auth_aid')?.value || cookieStore.get('aid')?.value || '',
		sid: cookieStore.get('auth_sid')?.value || cookieStore.get('sid')?.value || '',
		skey: cookieStore.get('auth_skey')?.value || cookieStore.get('skey')?.value || '',
	});
}