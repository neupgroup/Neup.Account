type SearchParamsLike = {
  get: (key: string) => string | null;
};

export type AuthCallbackContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
};

export function getAuthCallbackContext(searchParams: SearchParamsLike): AuthCallbackContext {
  const appId = searchParams.get('appId') || searchParams.get('appid');
  const appIdKey = searchParams.get('appid') ? 'appid' : 'appId';
  const authenticatesTo = searchParams.get('authenticatesTo');

  return {
    appId,
    appIdKey,
    authenticatesTo,
  };
}

export function hasAuthCallbackContext(searchParams: SearchParamsLike): boolean {
  const { appId, authenticatesTo } = getAuthCallbackContext(searchParams);
  return Boolean(appId && authenticatesTo);
}

export function appendAuthCallbackContext(path: string, searchParams: SearchParamsLike): string {
  const { appId, appIdKey, authenticatesTo } = getAuthCallbackContext(searchParams);

  if (!appId || !authenticatesTo) {
    return path;
  }

  const params = new URLSearchParams();
  params.set(appIdKey, appId);
  params.set('authenticatesTo', authenticatesTo);

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