export type RefactorLeftItem = {
	area: 'auth' | 'bridge' | 'manage' | 'data' | 'shared';
	path: string;
	issue: string;
	moveTo: string;
	extract: string[];
	priority: 'high' | 'medium';
};

// Backlog of app-layer logic that should live in services.
// Source review focused on files under app/ where page/route files still contain
// business rules, persistence access, token generation, or flow orchestration.
export const refactorsLeft: RefactorLeftItem[] = [
	{
		area: 'auth',
		path: 'app/auth/start/page.tsx',
		issue: 'Page performs direct Prisma lookup and auth-start orchestration.',
		moveTo: 'services/auth/start.ts',
		extract: [
			'Resolve appId/appid query normalization',
			'Fetch application display name',
			'Compose StartPage data model (accounts + active session + appName)',
		],
		priority: 'high',
	},
	{
		area: 'auth',
		path: 'app/auth/signup/layout.tsx',
		issue: 'Layout file contains signup flow state logic and direct Prisma read helpers.',
		moveTo: 'app/auth/signup/layout.tsx',
		extract: [
			'signup step order mapping',
			'authRequest status resolution + expiry validation',
			'current step path derivation',
		],
		priority: 'medium',
	},
	{
		area: 'bridge',
		path: 'app/bridge/handshake.v1/auth/grant/route.ts',
		issue: 'Route handles token generation, session mutation, app auth checks, and redirect decisions inline.',
		moveTo: 'services/bridge/handshake.ts',
		extract: [
			'validate appId + application configuration',
			'create tempToken and dependent key entry',
			'persist dependent key to session',
			'resolve authType (signin/signup) for app account pair',
			'build final redirect URL with error mapping',
		],
		priority: 'high',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/sign/route.ts',
		issue: 'Route mixes validation, AppAuthentication upsert, profile shaping, and external session creation.',
		moveTo: 'services/bridge/auth-sign.ts',
		extract: [
			'validate external request and session context',
			'upsert appAuthentication for account/app',
			'build sign response payload from profile + permissions',
			'create external app sessionValue + activeTill handling',
		],
		priority: 'high',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/session/route.ts',
		issue: 'Session validation, extension, and invalidation logic is implemented directly in route handler.',
		moveTo: 'services/bridge/auth-session.ts',
		extract: [
			'validate aid/sid/skey against session record',
			'extend session expiry and optional deviceType update',
			'invalidate session on delete',
			'map domain errors to API responses',
		],
		priority: 'high',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/grant/route.ts',
		issue: 'Large route contains token exchange, external role/permission resolution, JWT issuing, refresh, and grant status checks.',
		moveTo: 'services/bridge/auth-grant.ts',
		extract: [
			'tempToken validation + consume flow',
			'external role/permission resolution',
			'JWT payload/signing and expiry policy',
			'authSessionExternal create/update/get lifecycle',
			'notification trigger for app authorization',
		],
		priority: 'high',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/access/route.ts',
		issue: 'Route includes full access-domain logic for internal/external apps, membership upserts, and permission projections.',
		moveTo: 'services/bridge/auth-access.ts',
		extract: [
			'session verification for external sessions',
			'internal app access projection (memberships + accountAccess)',
			'external app access projection (role/team/permissions)',
			'access member upsert + validation rules',
			'resource-level permission normalization',
		],
		priority: 'high',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/refresh/route.ts',
		issue: 'Route directly performs refresh-token/session-expiry update logic.',
		moveTo: 'services/bridge/auth-refresh.ts',
		extract: [
			'validate active session for refresh',
			'extend expiry policy',
			'refresh response model',
		],
		priority: 'medium',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/auth/signout/route.ts',
		issue: 'Route handles external app session signout persistence and authorization rules inline.',
		moveTo: 'services/bridge/auth-signout.ts',
		extract: [
			'lookup session by sessionValue',
			'authorize optional appId ownership',
			'expire/delete external app session',
		],
		priority: 'medium',
	},
	{
		area: 'bridge',
		path: 'app/bridge/api.v1/profile/route.ts',
		issue: 'Route combines multiple authentication modes and profile privacy projection logic.',
		moveTo: 'services/bridge/profile.ts',
		extract: [
			'authenticate via header session or tempToken',
			'resolve target account via aid or neupid',
			'load profile + contacts',
			'privacy-aware response projection (self vs external)',
		],
		priority: 'high',
	},
	{
		area: 'manage',
		path: 'app/(manage)/access/[id]/page.tsx',
		issue: 'Page embeds multiple server actions with form parsing and redirect orchestration.',
		moveTo: 'services/manage/access/actions.ts',
		extract: [
			'addMemberAction server action',
			'addAssetAction server action',
			'assignRoleAction server action',
			'shared form-to-input parsers for access operations',
		],
		priority: 'medium',
	},
	{
		area: 'data',
		path: 'app/(manage)/data/applications/[id]/page.tsx',
		issue: 'Page defines delete server action and redirect policy inline.',
		moveTo: 'services/manage/applications/actions.ts',
		extract: [
			'deleteManagedApplicationAction(id)',
			'redirect target policy after delete',
		],
		priority: 'medium',
	},
	{
		area: 'data',
		path: 'app/(manage)/data/applications/page.tsx',
		issue: 'Page contains non-trivial data-composition logic combining managed and connected apps.',
		moveTo: 'services/manage/applications/list.ts',
		extract: [
			'merge managed + connected app lists',
			'deduplicate by id',
			'normalize to FlatAppItem model',
			'canCreateApplication permission flag',
		],
		priority: 'medium',
	},
	{
		area: 'shared',
		path: 'app/auth/accounts/account-list-item.tsx',
		issue: 'Client component contains account-switch flow branching and sign-in URL composition.',
		moveTo: 'services/auth/switch.ts',
		extract: [
			'switch decision matrix (brand/dependent/delegated/personal)',
			'signin URL builder with callback/redirect context',
			'single executeAccountSwitch function returning next navigation target',
		],
		priority: 'medium',
	},
];
