"use server";

import { getSessionCookies } from '@/core/helpers/cookies';
import { getValidatedStoredAccounts } from '@/core/helpers/session';
import { getAppDisplayName } from '@/core/helpers/auth-callback';
import {
	buildAuthCallbackWithStatus,
	buildAuthQuery,
	getServerAuthContext,
} from '@/core/helpers/auth-callback-server';
import prisma from '@/core/helpers/prisma';

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

export type AuthSignContext = ReturnType<typeof getServerAuthContext>;

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

function getFirst(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0] ?? undefined;
	}

	return value;
}

function getStep(value: string | string[] | undefined): AuthSignStep {
	const first = getFirst(value);
	if (first === 'access' || first === 'terms' || first === 'profile') {
		return first;
	}

	return 'profile';
}

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