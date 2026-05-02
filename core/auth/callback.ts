type SearchParamsLike = {
  get: (key: string) => string | null;
};

export type AuthCallbackContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
  purpose: 'externalAuthentication' | null;
};

export function getAuthCallbackContext(searchParams: SearchParamsLike): AuthCallbackContext {
  const appId = searchParams.get('appId') || searchParams.get('appid');
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

export function hasAuthCallbackContext(searchParams: SearchParamsLike): boolean {
  const { appId, authenticatesTo } = getAuthCallbackContext(searchParams);
  return Boolean(appId && authenticatesTo);
}

export function shouldReturnToAuthStartForExternalAuthentication(searchParams: SearchParamsLike): boolean {
  const { appId, authenticatesTo, purpose } = getAuthCallbackContext(searchParams);
  return Boolean(appId && authenticatesTo && purpose === 'externalAuthentication');
}

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

export function appendRedirect(path: string, redirects: string | null): string {
  if (!redirects) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}redirects=${encodeURIComponent(redirects)}`;
}

export function getAppDisplayName(appName: string | null | undefined): string {
  if (!appName) {
    return 'this app';
  }

  return appName;
}

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

  if (/^https?:\/\//i.test(authenticatesTo)) {
    return target.toString();
  }

  return `${target.pathname}${target.search}${target.hash}`;
}

import prisma from '@/core/helpers/prisma';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type ServerAuthContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
  purpose: 'externalAuthentication' | null;
};

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0] ?? undefined;
  return value;
}

export function getServerAuthContext(searchParams: SearchParamsRecord): ServerAuthContext {
  const appId = pickFirst(searchParams.appId) || pickFirst(searchParams.appid) || null;
  const appIdKey: 'appId' | 'appid' = pickFirst(searchParams.appid) ? 'appid' : 'appId';
  const authenticatesTo = pickFirst(searchParams.authenticatesTo) || pickFirst(searchParams.authenticatesto) || null;
  const purpose = pickFirst(searchParams.purpose) === 'externalAuthentication' ? 'externalAuthentication' : null;
  return { appId, appIdKey, authenticatesTo, purpose };
}

export function buildAuthQuery(context: ServerAuthContext): string {
  const params = new URLSearchParams();
  if (context.appId) params.set(context.appIdKey, context.appId);
  if (context.authenticatesTo) params.set('authenticatesTo', context.authenticatesTo);
  if (context.purpose) params.set('purpose', context.purpose);
  return params.toString();
}

export function buildAuthPath(pathname: string, context: ServerAuthContext): string {
  const query = buildAuthQuery(context);
  return query ? `${pathname}?${query}` : pathname;
}

export function buildAuthCallbackWithStatus(context: ServerAuthContext, status: 'allowed' | 'denied' | 'cancelled'): string {
  if (!context.authenticatesTo) return '/auth/start';
  return buildCallbackUrl(context.authenticatesTo, context, status);
}

export async function getApplicationName(appId: string | null): Promise<string | null> {
  if (!appId) return null;
  const app = await prisma.application.findUnique({ where: { id: appId }, select: { name: true } });
  return app?.name ?? null;
}
