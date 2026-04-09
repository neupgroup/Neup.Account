import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logError } from '@/core/helpers/logger';
import { makeNotification } from '@/services/notifications';

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
    const sessions = await prisma.session.findMany({
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
    await prisma.session.update({
      where: { id: sessionWithToken.id },
      data: { dependentKeys },
    });

    const externalRole = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: sessionWithToken.accountId, appId } },
    });

    const externalPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: sessionWithToken.accountId, appId } },
    });

    const roleName = externalRole?.role || 'user';
    const permissions = (externalPermissions?.permissions as string[]) || [];

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

    if (externalRole?.hasExtra) {
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

    await prisma.authSessionExternal.create({
      data: {
        id: sid,
        accountId: sessionWithToken.accountId,
        appId,
        sessionId: sessionWithToken.id,
        sessionKey: skey,
        jwt: token,
        expiresOn: sessionExpiresOn,
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
        sid,
        skey,
        jwt: token,
        exp: jwtExp,
        role: roleName,
        ...(externalRole?.hasExtra ? { per: permissions } : {}),
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
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        appId,
        expiresOn: { gt: new Date() },
      },
      include: {
        application: true,
      },
    });

    if (!externalSession) {
      return {
        status: 401,
        body: { error: 'invalid_session', error_description: 'Session not found or expired' },
      };
    }

    const externalRole = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } },
    });

    const externalPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } },
    });

    const roleName = externalRole?.role || 'user';
    const permissions = (externalPermissions?.permissions as string[]) || [];

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

    if (externalRole?.hasExtra) {
      payload.per = permissions;
    }

    if (!externalSession.application.appSecret) {
      return {
        status: 500,
        body: { error: 'invalid_app', error_description: 'Application configuration error' },
      };
    }

    const newToken = jwt.sign(payload, externalSession.application.appSecret);

    await prisma.authSessionExternal.update({
      where: { id: sid },
      data: {
        jwt: newToken,
        expiresOn: newSessionExpiresOn,
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
        ...(externalRole?.hasExtra ? { per: permissions } : {}),
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
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        appId,
        expiresOn: { gt: new Date() },
      },
    });

    if (!externalSession) {
      return {
        status: 401,
        body: { error: 'invalid_grant', error_description: 'Grant not found or expired' },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        aid: externalSession.accountId,
        appId: externalSession.appId,
        expiresOn: externalSession.expiresOn,
        lastLoggedIn: externalSession.createdAt,
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_check_grant');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
