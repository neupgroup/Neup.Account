import prisma from '@/core/helpers/prisma';
import { buildCallbackUrl } from '@/core/auth/callback';

type SearchParamsRecord = Record<string, string | string[] | undefined>;

type ServerAuthContext = {
  appId: string | null;
  appIdKey: 'appId' | 'appid';
  authenticatesTo: string | null;
  purpose: 'externalAuthentication' | null;
};

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

export function getServerAuthContext(searchParams: SearchParamsRecord): ServerAuthContext {
  const appId = pickFirst(searchParams.appId) || pickFirst(searchParams.appid) || null;
  const appIdKey: 'appId' | 'appid' = pickFirst(searchParams.appid) ? 'appid' : 'appId';
  const authenticatesTo = pickFirst(searchParams.authenticatesTo) || pickFirst(searchParams.authenticatesto) || null;
  const purpose = pickFirst(searchParams.purpose) === 'externalAuthentication' ? 'externalAuthentication' : null;

  return {
    appId,
    appIdKey,
    authenticatesTo,
    purpose,
  };
}

export function buildAuthQuery(context: ServerAuthContext): string {
  const params = new URLSearchParams();

  if (context.appId) {
    params.set(context.appIdKey, context.appId);
  }

  if (context.authenticatesTo) {
    params.set('authenticatesTo', context.authenticatesTo);
  }

  if (context.purpose) {
    params.set('purpose', context.purpose);
  }

  return params.toString();
}

export function buildAuthPath(pathname: string, context: ServerAuthContext): string {
  const query = buildAuthQuery(context);
  if (!query) {
    return pathname;
  }

  return `${pathname}?${query}`;
}

export function buildAuthCallbackWithStatus(context: ServerAuthContext, status: 'allowed' | 'denied' | 'cancelled'): string {
  if (!context.authenticatesTo) {
    return '/auth/start';
  }

  return buildCallbackUrl(context.authenticatesTo, context, status);
}

export async function getApplicationName(appId: string | null): Promise<string | null> {
  if (!appId) {
    return null;
  }

  const app = await prisma.application.findUnique({
    where: { id: appId },
    select: { name: true },
  });

  return app?.name ?? null;
}
