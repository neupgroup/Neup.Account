// Handles auth callback context — the appId, authenticatesTo, and purpose params
// that flow through the external authentication handshake.
// Contains both client-side helpers (URLSearchParams) and server-side helpers
// (Record<string, string | string[]> from Next.js page searchParams).

type SearchParamsLike = {
  get: (key: string) => string | null;
};

// Represents the external auth context passed through query params during the handshake.
export type AuthCallbackContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
  purpose: 'externalAuthentication' | null;
};

// Parses the auth callback context from client-side URLSearchParams.
export function getAuthCallbackContext(searchParams: SearchParamsLike): AuthCallbackContext {
  const appId = searchParams.get('appId') || searchParams.get('appid');
  // Preserve the original casing of the appId key so it round-trips correctly
  const appIdKey = searchParams.get('appid') ? 'appid' : 'appId';
  const authenticatesTo = searchParams.get('authenticatesTo') || searchParams.get('authenticatesto');
  const purpose = searchParams.get('purpose') === 'externalAuthentication' ? 'externalAuthentication' : null;

  return {
    appId,
    appIdKey,
    authenticatesTo,
    purpose,
  };
}

// Returns true if both appId and authenticatesTo are present in the search params.
export function hasAuthCallbackContext(searchParams: SearchParamsLike): boolean {
  const { appId, authenticatesTo } = getAuthCallbackContext(searchParams);
  return Boolean(appId && authenticatesTo);
}

// Returns true if the current flow is an external app authentication request.
// Used to decide whether to redirect back to /auth/sign after login.
export function shouldReturnToAuthStartForExternalAuthentication(searchParams: SearchParamsLike): boolean {
  const { appId, authenticatesTo, purpose } = getAuthCallbackContext(searchParams);
  return Boolean(appId && authenticatesTo && purpose === 'externalAuthentication');
}

// Appends the auth callback context (appId, authenticatesTo, purpose) to a path.
// Used to carry the external auth context through multi-step auth flows.
export function appendAuthCallbackContext(path: string, searchParams: SearchParamsLike): string {
  const { appId, appIdKey, authenticatesTo, purpose } = getAuthCallbackContext(searchParams);

  if (!appId || !authenticatesTo) {
    return path;
  }

  const params = new URLSearchParams();
  params.set(appIdKey, appId);
  params.set('authenticatesTo', authenticatesTo);

  if (purpose) {
    params.set('purpose', purpose);
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${params.toString()}`;
}

// Appends a redirects param to a path, encoding it safely.
export function appendRedirect(path: string, redirects: string | null): string {
  if (!redirects) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}redirects=${encodeURIComponent(redirects)}`;
}

// Returns the app's display name, falling back to 'this app' if not provided.
export function getAppDisplayName(appName: string | null | undefined): string {
  if (!appName) {
    return 'this app';
  }

  return appName;
}

// Builds the final callback URL to redirect the external app to after auth completes.
// Appends appId, authenticatesTo, and an optional authStatus to the target URL.
export function buildCallbackUrl(
  authenticatesTo: string,
  context: Pick<AuthCallbackContext, 'appId' | 'appIdKey' | 'authenticatesTo'>,
  status?: 'allowed' | 'denied' | 'cancelled'
): string {
  const target = new URL(authenticatesTo, 'http://localhost');

  if (context.appId) {
    target.searchParams.set(context.appIdKey, context.appId);
  }

  if (context.authenticatesTo) {
    target.searchParams.set('authenticatesTo', context.authenticatesTo);
  }

  if (status) {
    target.searchParams.set('authStatus', status);
  }

  // If the target is an absolute URL, return the full URL; otherwise return just the path
  if (/^https?:\/\//i.test(authenticatesTo)) {
    return target.toString();
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

// --- Server-side variants ---
// The functions below work with Next.js page searchParams (Record<string, string | string[]>)
// instead of URLSearchParams, since server components receive params in that shape.

import prisma from '@/core/helpers/prisma';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type ServerAuthContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
  purpose: 'externalAuthentication' | null;
};

// Picks the first value from a string or string array (Next.js searchParams can be either).
function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0] ?? undefined;
  return value;
}

// Parses the auth callback context from server-side searchParams.
export function getServerAuthContext(searchParams: SearchParamsRecord): ServerAuthContext {
  const appId = pickFirst(searchParams.appId) || pickFirst(searchParams.appid) || null;
  const appIdKey: 'appId' | 'appid' = pickFirst(searchParams.appid) ? 'appid' : 'appId';
  const authenticatesTo = pickFirst(searchParams.authenticatesTo) || pickFirst(searchParams.authenticatesto) || null;
  const purpose = pickFirst(searchParams.purpose) === 'externalAuthentication' ? 'externalAuthentication' : null;
  return { appId, appIdKey, authenticatesTo, purpose };
}

// Serializes a ServerAuthContext into a query string.
export function buildAuthQuery(context: ServerAuthContext): string {
  const params = new URLSearchParams();
  if (context.appId) params.set(context.appIdKey, context.appId);
  if (context.authenticatesTo) params.set('authenticatesTo', context.authenticatesTo);
  if (context.purpose) params.set('purpose', context.purpose);
  return params.toString();
}

// Appends the auth context query string to a pathname.
export function buildAuthPath(pathname: string, context: ServerAuthContext): string {
  const query = buildAuthQuery(context);
  return query ? `${pathname}?${query}` : pathname;
}

// Builds the callback URL with an auth status (allowed/denied/cancelled).
// Falls back to /auth/start if no authenticatesTo is set.
export function buildAuthCallbackWithStatus(context: ServerAuthContext, status: 'allowed' | 'denied' | 'cancelled'): string {
  if (!context.authenticatesTo) return '/auth/start';
  return buildCallbackUrl(context.authenticatesTo, context, status);
}

// Looks up the display name of an application by its ID.
export async function getApplicationName(appId: string | null): Promise<string | null> {
  if (!appId) return null;
  const app = await prisma.application.findUnique({ where: { id: appId }, select: { name: true } });
  return app?.name ?? null;
}
