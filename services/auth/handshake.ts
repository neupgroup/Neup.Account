import { getActiveSession } from '@/core/helpers/auth-actions';
import { logError } from '@/core/helpers/logger';
import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';

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

  const finalRedirectUrl = new URL(redirectsTo);
  searchParams.forEach((value, key) => {
    if (key !== 'redirectsTo' && key !== 'appId') {
      finalRedirectUrl.searchParams.set(key, value);
    }
  });

  if (!appId) {
    finalRedirectUrl.searchParams.set('error', 'missing_app_id');
    finalRedirectUrl.searchParams.set('error_description', 'An application ID (appId) must be provided.');
    return { redirectTo: finalRedirectUrl.toString() };
  }

  try {
    const application = await prisma.application.findUnique({ where: { id: appId } });

    if (!application || !application.appSecret) {
      finalRedirectUrl.searchParams.set('error', 'invalid_app');
      finalRedirectUrl.searchParams.set('error_description', 'The provided application ID is invalid or not fully configured.');
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
    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + 5);

    const currentSession = await prisma.session.findUnique({
      where: { id: session.sessionId },
      select: { dependentKeys: true },
    });

    const existingKeys = Array.isArray(currentSession?.dependentKeys) ? currentSession.dependentKeys : [];

    const newKeyEntry = {
      app: appId,
      key: tempToken,
      expiresOn,
      isUsed: false,
    };

    await prisma.session.update({
      where: { id: session.sessionId },
      data: {
        dependentKeys: [...existingKeys, newKeyEntry],
      },
    });

    const appAuth = await prisma.appAuthentication.findUnique({
      where: {
        appId_accountId: {
          appId,
          accountId: session.accountId,
        },
      },
    });

    const authType = appAuth ? 'signin' : 'signup';

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
