import { getActiveSession } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';
import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';

/**
 * Function bridgeBuildGrantRedirect.
 */
export async function bridgeBuildGrantRedirect(input: {
  requestUrl: string;
  pathname: string;
  searchParams: URLSearchParams;
}): Promise<{ redirectTo: string }> {
  const { requestUrl, pathname, searchParams } = input;
  const redirectsTo = searchParams.get('redirectsTo');
  const appId = searchParams.get('appId');

  if (!redirectsTo) {
    const errorUrl = new URL('/auth/start', requestUrl);
    errorUrl.searchParams.set('error', 'invalid_request');
    errorUrl.searchParams.set('error_description', 'The required "redirectsTo" parameter was not provided.');
    return { redirectTo: errorUrl.toString() };
  }

  if (!appId) {
    const errorUrl = new URL('/auth/start', requestUrl);
    errorUrl.searchParams.set('error', 'missing_app_id');
    errorUrl.searchParams.set('error_description', 'An application ID (appId) must be provided.');
    return { redirectTo: errorUrl.toString() };
  }

  // Validate redirectsTo against registered callback URLs before doing anything else
  let redirectOrigin: string;
  try {
    redirectOrigin = new URL(redirectsTo).origin;
  } catch {
    const errorUrl = new URL('/auth/start', requestUrl);
    errorUrl.searchParams.set('error', 'invalid_redirect');
    errorUrl.searchParams.set('error_description', 'The redirectsTo parameter is not a valid URL.');
    return { redirectTo: errorUrl.toString() };
  }

  const finalRedirectUrl = new URL(redirectsTo);
  searchParams.forEach((value, key) => {
    if (key !== 'redirectsTo' && key !== 'appId') {
      finalRedirectUrl.searchParams.set(key, value);
    }
  });

  try {
    const [application, registeredCallbacks] = await Promise.all([
      prisma.application.findUnique({ where: { id: appId } }),
      prisma.applicationBridge.findMany({
        where: { appId, type: 'callbackUrl' },
        select: { value: true },
      }),
    ]);

    if (!application || !application.appSecret) {
      finalRedirectUrl.searchParams.set('error', 'invalid_app');
      finalRedirectUrl.searchParams.set('error_description', 'The provided application ID is invalid or not fully configured.');
      return { redirectTo: finalRedirectUrl.toString() };
    }

    // Reject if no callback URLs are registered or the origin doesn't match any
    const isAllowed = registeredCallbacks.some((cb) => {
      try {
        return new URL(cb.value).origin === redirectOrigin;
      } catch {
        return false;
      }
    });

    if (!isAllowed) {
      finalRedirectUrl.searchParams.set('error', 'invalid_redirect');
      finalRedirectUrl.searchParams.set('error_description', 'The redirectsTo URL is not registered as a valid callback for this application.');
      return { redirectTo: finalRedirectUrl.toString() };
    }

    const session = await getActiveSession();

    if (!session) {
      const backTo = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      const signInUrl = new URL('/auth/start', requestUrl);
      signInUrl.searchParams.set('redirects', backTo);
      searchParams.forEach((value, key) => {
        if (key !== 'redirects') {
          signInUrl.searchParams.set(key, value);
        }
      });
      return { redirectTo: signInUrl.toString() };
    }

    const tempToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await prisma.authRequest.create({
      data: {
        id: tempToken,
        type: 'bridge_grant',
        status: 'pending',
        data: { appId },
        accountId: session.accountId,
        expiresAt,
      },
    });

    const existingConnection = await prisma.applicationConnection.findUnique({
      where: {
        accountId_appId: {
          accountId: session.accountId,
          appId,
        },
      },
      select: { id: true },
    });

    const authType = existingConnection ? 'signin' : 'signup';

    finalRedirectUrl.searchParams.set('tempToken', tempToken);
    finalRedirectUrl.searchParams.set('authType', authType);

    return { redirectTo: finalRedirectUrl.toString() };
  } catch (error) {
    await logError('database', error, 'bridge_build_grant_redirect');
    finalRedirectUrl.searchParams.set('error', 'internal_server_error');
    finalRedirectUrl.searchParams.set('error_description', 'An unexpected error occurred during handshake.');
    return { redirectTo: finalRedirectUrl.toString() };
  }
}
