import { getSessionCookies } from '@/core/helpers/cookies';
import { getValidatedStoredAccounts } from '@/core/auth/session';
import { getAppDisplayName } from '@/core/auth/callback';
import {
	buildAuthCallbackWithStatus,
	buildAuthQuery,
	getServerAuthContext,
} from '@/core/auth/callback';
import prisma from '@/core/helpers/prisma';
import { randomBytes } from 'crypto';
import { getUserProfile } from '@/services/user';
import { validateExternalRequest } from '@/services/auth/validate';

const EXTERNAL_LOGIN_PREFIX = 'external_app:';
function externalLoginType(appId: string) {
	return `${EXTERNAL_LOGIN_PREFIX}${appId}`;
}

/**
 * Type AuthSignStep.
 */
export type AuthSignStep = 'profile' | 'access' | 'terms';

export const authSignStepOrder: AuthSignStep[] = ['profile', 'access', 'terms'];

const accessLabelMap: Record<string, string> = {
	neupid: 'NeupID',
	firstName: 'First name',
	lastName: 'Last name',
	middleName: 'Middle name',
	displayName: 'Display name',
	dateBirth: 'Date of birth',
	age: 'Age',
	isMinor: 'Minor status',
	gender: 'Gender',
	name: 'Name',
	email: 'Email',
	phone: 'Phone',
};


/**
 * Type AuthSignContext.
 */
export type AuthSignContext = ReturnType<typeof getServerAuthContext>;


/**
 * Type AuthSignPageData.
 */
export type AuthSignPageData = {
	redirectTo?: string;
	context: AuthSignContext;
	step: AuthSignStep;
	displayAppName: string;
	hasActiveSession: boolean;
	startPageUrl: string;
	denyUrl: string;
	cancelUrl: string;
	continueUrl: string;
	stepTitleMap: Record<AuthSignStep, string>;
	accessItems: string[];
	termsText: string;
	profileNextUrl: string;
	accessNextUrl: string;
	accessBackUrl: string;
	termsBackUrl: string;
	hasBuilderData: boolean;
	application: {
		id: string;
		name: string;
		description: string | null;
		website: string | null;
		developer: string | null;
		access: unknown;
		policies: unknown;
	} | null;
};


/**
 * Function getFirst.
 */
function getFirst(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0] ?? undefined;
	}

	return value;
}


/**
 * Function getStep.
 */
function getStep(value: string | string[] | undefined): AuthSignStep {
	const first = getFirst(value);
	if (first === 'access' || first === 'terms' || first === 'profile') {
		return first;
	}

	return 'profile';
}


/**
 * Function buildSignUrl.
 */
function buildSignUrl(
	context: AuthSignContext,
	step: AuthSignStep,
	extra: Record<string, string> = {}
): string {
	const params = new URLSearchParams(buildAuthQuery(context));
	params.set('step', step);

	for (const [key, value] of Object.entries(extra)) {
		params.set(key, value);
	}

	const query = params.toString();
	return query ? `/auth/sign?${query}` : '/auth/sign';
}


/**
 * Function normalizeAccess.
 */
function normalizeAccess(access: unknown): string[] {
	if (!Array.isArray(access)) {
		return ['Name', 'Email', 'NeupID', 'Phone'];
	}

	const values = access
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => accessLabelMap[entry] || entry)
		.filter((entry) => entry.trim().length > 0);

	return values.length > 0 ? values : ['Name', 'Email', 'NeupID', 'Phone'];
}


/**
 * Function getTermsText.
 */
function getTermsText(policies: unknown): string {
	if (!Array.isArray(policies)) {
		return 'By continuing, you agree to this application\'s terms and data usage rules.';
	}

	const termsEntry = policies.find((policy) => {
		if (!policy || typeof policy !== 'object') {
			return false;
		}

		const record = policy as Record<string, unknown>;
		const name = typeof record.name === 'string' ? record.name.toLowerCase() : '';
		return name.includes('terms');
	});

	if (!termsEntry || typeof termsEntry !== 'object') {
		return 'By continuing, you agree to this application\'s terms and data usage rules.';
	}

	const record = termsEntry as Record<string, unknown>;
	const policyText = typeof record.policy === 'string' ? record.policy.trim() : '';
	return policyText.length > 0
		? policyText
		: 'By continuing, you agree to this application\'s terms and data usage rules.';
}


/**
 * Function getAuthSignPageData.
 */
export async function getAuthSignPageData(
	searchParams: Record<string, string | string[] | undefined>
): Promise<AuthSignPageData> {
	const context = getServerAuthContext(searchParams);
	const step = getStep(searchParams.step);

	const application = context.appId
		? await prisma.application.findUnique({
				where: { id: context.appId },
				select: {
					id: true,
					name: true,
					description: true,
					website: true,
					developer: true,
					access: true,
					policies: true,
				},
		  })
		: null;

	const displayAppName = getAppDisplayName(application?.name);

	const storedAccounts = await getValidatedStoredAccounts();
	const { accountId, sessionId, sessionKey } = await getSessionCookies();
	const hasActiveSession = Boolean(accountId && sessionId && sessionKey);

	const skipAccountCheck = getFirst(searchParams.skipAccountCheck) === '1';
	if (storedAccounts.length >= 2 && !skipAccountCheck) {
		const query = buildAuthQuery(context);
		const returnTo = buildSignUrl(context, step, { skipAccountCheck: '1' });
		const startParams = new URLSearchParams(query);
		startParams.set('redirects', returnTo);
		return {
			redirectTo: `/auth/start?${startParams.toString()}`,
			context,
			step,
			displayAppName,
			hasActiveSession,
			startPageUrl: '/auth/start',
			denyUrl: '/auth/start',
			cancelUrl: '/auth/start',
			continueUrl: '/auth/start',
			stepTitleMap: { profile: 'Profile', access: 'Access', terms: 'Terms' },
			accessItems: ['Name', 'Email', 'NeupID', 'Phone'],
			termsText: 'By continuing, you agree to this application\'s terms and data usage rules.',
			profileNextUrl: '/auth/start',
			accessNextUrl: '/auth/start',
			accessBackUrl: '/auth/start',
			termsBackUrl: '/auth/start',
			hasBuilderData: false,
			application,
		};
	}

	if (!context.appId || !context.authenticatesTo) {
		return {
			redirectTo: '/auth/start',
			context,
			step,
			displayAppName,
			hasActiveSession,
			startPageUrl: '/auth/start',
			denyUrl: '/auth/start',
			cancelUrl: '/auth/start',
			continueUrl: '/auth/start',
			stepTitleMap: { profile: 'Profile', access: 'Access', terms: 'Terms' },
			accessItems: ['Name', 'Email', 'NeupID', 'Phone'],
			termsText: 'By continuing, you agree to this application\'s terms and data usage rules.',
			profileNextUrl: '/auth/start',
			accessNextUrl: '/auth/start',
			accessBackUrl: '/auth/start',
			termsBackUrl: '/auth/start',
			hasBuilderData: false,
			application,
		};
	}

	const callbackQuery = buildAuthQuery(context);
	const startPageUrl = callbackQuery ? `/auth/start?${callbackQuery}` : '/auth/start';
	const denyUrl = buildAuthCallbackWithStatus(context, 'denied');
	const cancelUrl = buildAuthCallbackWithStatus(context, 'cancelled');
	const continueUrl = buildAuthCallbackWithStatus(context, 'allowed');

	const stepTitleMap: Record<AuthSignStep, string> = {
		profile: 'Profile',
		access: 'Access',
		terms: 'Terms',
	};

	const accessItems = normalizeAccess(application?.access);
	const termsText = getTermsText(application?.policies);

	const profileNextUrl = buildSignUrl(context, 'access');
	const accessNextUrl = buildSignUrl(context, 'terms');
	const accessBackUrl = buildSignUrl(context, 'profile');
	const termsBackUrl = buildSignUrl(context, 'access');

	const hasBuilderData = Boolean(
		application?.description?.trim() ||
			application?.developer?.trim() ||
			application?.website?.trim() ||
			Array.isArray(application?.access) ||
			Array.isArray(application?.policies)
	);

	return {
		context,
		step,
		displayAppName,
		hasActiveSession,
		startPageUrl,
		denyUrl,
		cancelUrl,
		continueUrl,
		stepTitleMap,
		accessItems,
		termsText,
		profileNextUrl,
		accessNextUrl,
		accessBackUrl,
		termsBackUrl,
		hasBuilderData,
		application,
	};
}


/**
 * Function bridgeSignIntoApplication.
 */
export async function bridgeSignIntoApplication(input: { appId?: string; appType?: string; [key: string]: any }): Promise<{ status: number; body: Record<string, any> }> {
	try {
		const appId = input?.appId;
		const appType = input?.appType;

		if (!appId) {
			return { status: 400, body: { success: false, error: 'appId is required.' } };
		}

		const validation = await validateExternalRequest(input as any);
		if (!validation.success) {
			return { status: validation.status ?? 401, body: { success: false, error: validation.error } };
		}

		const { accountId } = validation.user;

		const existingExternal = await prisma.applicationConnection.findUnique({
			where: {
				accountId_appId: {
					accountId,
					appId,
				},
			},
			select: { id: true },
		});

		const isNewSignup = !existingExternal;

		const profile = await getUserProfile(accountId);
		if (!profile) {
			return { status: 404, body: { success: false, error: 'User profile not found.' } };
		}

		const responseData: Record<string, any> = {
			success: true,
			accountId,
			displayName: profile.nameDisplay || `${profile.nameFirst || ''} ${profile.nameLast || ''}`.trim(),
			displayImage: profile.accountPhoto || '',
			isNewSignup,
		};

		if (appType === 'external') {
			const authSid = input?.auth_sid || input?.auth_session_id;
			if (!authSid) {
				return { status: 400, body: { success: false, error: 'auth_sid is required for external apps.' } };
			}

			const sessionValue = randomBytes(32).toString('hex');
			const activeTill = new Date();
			activeTill.setDate(activeTill.getDate() + 30);

			await prisma.applicationConnection.upsert({
				where: {
					accountId_appId: {
						accountId,
						appId,
					},
				},
				update: {},
				create: { accountId, appId },
			});

			await prisma.authSession.create({
				data: {
					accountId,
					ipAddress: 'Unknown IP',
					userAgent: 'External Application',
					lastLoggedIn: new Date(),
					loginType: externalLoginType(appId),
					validTill: activeTill,
					key: sessionValue,
				},
			});

			responseData.sessionValue = sessionValue;
			responseData.activeTill = activeTill.toISOString();
		}

		return { status: 200, body: responseData };
	} catch {
		return { status: 500, body: { success: false, error: 'Internal server error.' } };
	}
}

// Looks up the display name of an application by its ID.
export async function getApplicationName(appId: string | null): Promise<string | null> {
  if (!appId) return null;
  const app = await prisma.application.findUnique({ where: { id: appId }, select: { name: true } });
  return app?.name ?? null;
}
