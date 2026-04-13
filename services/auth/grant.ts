import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logError } from '@/core/helpers/logger';
import { makeNotification } from '@/services/notifications';

/**
 * Function bridgeIssueGrant.
 */
export async function bridgeIssueGrant(input: {
  tempToken?: string;
  appId?: string;
}): Promise<{ status: number; body: Record<string, any> }> {
  const { tempToken, appId } = input;

  if (!tempToken || !appId) {
    return {
      status: 400,
      body: { error: 'invalid_request', error_description: 'Missing tempToken or appId' },
    };
  }

  try {
    const sessions = await prisma.authSession.findMany({
      where: {
        isExpired: false,
        expiresOn: { gt: new Date() },
      },
      include: {
        account: true,
      },
    });

    const sessionWithToken = sessions.find((s) => {
      if (!Array.isArray(s.dependentKeys)) return false;
      return (s.dependentKeys as any[]).some((k: any) => k.app === appId && k.key === tempToken && !k.isUsed);
    });

    if (!sessionWithToken) {
      return {
        status: 401,
        body: { error: 'invalid_token', error_description: 'Token not found, expired, or already used' },
      };
    }

    const dependentKeys = sessionWithToken.dependentKeys as any[];
    const tokenIndex = dependentKeys.findIndex((k: any) => k.app === appId && k.key === tempToken && !k.isUsed);

    if (tokenIndex === -1) {
      return {
        status: 401,
        body: { error: 'invalid_token', error_description: 'Token validation failed' },
      };
    }

    const tokenData = dependentKeys[tokenIndex];
    if (new Date(tokenData.expiresOn) < new Date()) {
      return {
        status: 401,
        body: { error: 'token_expired', error_description: 'Token has expired' },
      };
    }

    dependentKeys[tokenIndex].isUsed = true;
    await prisma.authSession.update({
      where: { id: sessionWithToken.id },
      data: { dependentKeys },
    });

    const roleName = 'user';
    const permissions: string[] = [];

    const sid = crypto.randomUUID();
    const skey = crypto.randomBytes(32).toString('hex');

    const sessionExpSeconds = 60 * 60 * 24 * 7;
    const sessionExpiresOn = new Date();
    sessionExpiresOn.setSeconds(sessionExpiresOn.getSeconds() + sessionExpSeconds);

    const jwtExpSeconds = 60 * 7;
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    const payload: any = {
      aid: sessionWithToken.accountId,
      role: roleName,
      iat,
      exp: jwtExp,
    };

    if (permissions.length > 0) {
      payload.per = permissions;
    }

    const application = await prisma.application.findUnique({
      where: { id: appId },
    });

    if (!application || !application.appSecret) {
      return {
        status: 500,
        body: { error: 'invalid_app', error_description: 'Application configuration error' },
      };
    }

    const token = jwt.sign(payload, application.appSecret);

    const externalSession = await prisma.authSession.create({
      data: {
        accountId: sessionWithToken.accountId,
        application: appId,
        applicationType: 'external',
        applicationDomain: application.website || null,
        ipAddress: sessionWithToken.ipAddress,
        userAgent: sessionWithToken.userAgent,
        geolocation: sessionWithToken.geolocation,
        lastLoggedIn: new Date(),
        loginType: 'external_app',
        expiresOn: sessionExpiresOn,
        isExpired: false,
        authSessionKey: skey,
        dependentKeys: {
          parentSessionId: sessionWithToken.id,
          appId,
        },
        permissions,
      },
    });

    await makeNotification({
      recipient_id: sessionWithToken.accountId,
      action: 'informative.application_authorized',
      message: `Application ${application.name} was authorized.`,
    });

    return {
      status: 200,
      body: {
        aid: sessionWithToken.accountId,
        sid: externalSession.id,
        skey,
        jwt: token,
        exp: jwtExp,
        role: roleName,
        ...(permissions.length > 0 ? { per: permissions } : {}),
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_issue_grant');
    return {
      status: 500,
      body: { error: 'internal_server_error', error_description: 'An unexpected error occurred' },
    };
  }
}


/**
 * Function bridgeRefreshGrant.
 */
export async function bridgeRefreshGrant(input: {
  sid?: string;
  aid?: string;
  skey?: string;
  appId?: string;
}): Promise<{ status: number; body: Record<string, any> }> {
  const { sid, aid, skey, appId } = input;

  if (!sid || !aid || !skey || !appId) {
    return {
      status: 400,
      body: { error: 'invalid_request', error_description: 'Missing sid, aid, skey, or appId' },
    };
  }

  try {
    const appSession = await prisma.authSession.findFirst({
      where: {
        id: sid,
        accountId: aid,
        authSessionKey: skey,
        application: appId,
        applicationType: 'external',
        isExpired: false,
        expiresOn: { gt: new Date() },
      },
    });

    if (!appSession) {
      return {
        status: 401,
        body: { error: 'invalid_session', error_description: 'Session not found or expired' },
      };
    }

    const roleName = 'user';
    const permissions = Array.isArray(appSession.permissions)
      ? (appSession.permissions as string[])
      : [];

    const sessionExpSeconds = 60 * 60 * 24 * 7;
    const newSessionExpiresOn = new Date();
    newSessionExpiresOn.setSeconds(newSessionExpiresOn.getSeconds() + sessionExpSeconds);

    const jwtExpSeconds = 60 * 7;
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    const payload: any = {
      aid,
      role: roleName,
      iat,
      exp: jwtExp,
    };

    if (permissions.length > 0) {
      payload.per = permissions;
    }

    const application = await prisma.application.findUnique({ where: { id: appId } });
    if (!application?.appSecret) {
      return {
        status: 500,
        body: { error: 'invalid_app', error_description: 'Application configuration error' },
      };
    }

    const newToken = jwt.sign(payload, application.appSecret);

    await prisma.authSession.update({
      where: { id: sid },
      data: {
        expiresOn: newSessionExpiresOn,
        lastLoggedIn: new Date(),
      },
    });

    return {
      status: 200,
      body: {
        aid,
        sid,
        jwt: newToken,
        exp: jwtExp,
        role: roleName,
        ...(permissions.length > 0 ? { per: permissions } : {}),
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_refresh_grant');
    return {
      status: 500,
      body: { error: 'internal_server_error', error_description: 'An unexpected error occurred' },
    };
  }
}


/**
 * Function bridgeCheckGrant.
 */
export async function bridgeCheckGrant(input: {
  aid?: string;
  sid?: string;
  skey?: string;
  appId?: string;
}): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, sid, skey, appId } = input;

  if (!aid || !sid || !skey || !appId) {
    return {
      status: 400,
      body: { error: 'invalid_request', error_description: 'Missing aid, sid, skey, or appId' },
    };
  }

  try {
    const appSession = await prisma.authSession.findFirst({
      where: {
        id: sid,
        accountId: aid,
        authSessionKey: skey,
        application: appId,
        applicationType: 'external',
        isExpired: false,
        expiresOn: { gt: new Date() },
      },
    });

    if (!appSession) {
      return {
        status: 401,
        body: { error: 'invalid_grant', error_description: 'Grant not found or expired' },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        aid: appSession.accountId,
        appId: appSession.application,
        expiresOn: appSession.expiresOn,
        lastLoggedIn: appSession.lastLoggedIn,
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_check_grant');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
