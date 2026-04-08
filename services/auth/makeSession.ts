"use server";

import { headers } from 'next/headers';
import { createAndSetSession } from '@/core/helpers/session';
import { makeNotification } from '@/services/notifications';

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