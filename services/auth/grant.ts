import prisma from '@/core/helpers/prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logError } from '@/core/helpers/logger';
import { makeNotification } from '@/services/notifications';
import { getUserPermissions, isRootUser } from '@/services/user';

const EXTERNAL_LOGIN_PREFIX = 'external_app:';
function externalLoginType(appId: string) {
  return `${EXTERNAL_LOGIN_PREFIX}${appId}`;
}

// Resolves the role name and permission set for an account in the context of an external app.
async function resolveAccountGrant(accountId: string, appId: string): Promise<{ role: string; permissions: string[] }> {
  const [account, permissions, isRoot] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, select: { accountType: true } }),
    getUserPermissions(accountId, appId),
    isRootUser(accountId),
  ]);

  const role = isRoot ? 'root' : (account?.accountType ?? 'individual');
  return { role, permissions };
}

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
    const now = new Date();

    // Atomically consume the token in a single query — no TOCTOU window.
    // update() throws if no row matches, which means the token was already used,
    // expired, or never existed. We catch that and return 401.
    let request: { id: string; type: string; data: unknown; accountId: string | null; expiresAt: Date };
    try {
      request = await prisma.authRequest.update({
        where: {
          id: tempToken,
          type: 'bridge_grant',
          status: 'pending',
        },
        data: { status: 'used' },
        select: { id: true, type: true, data: true, accountId: true, expiresAt: true },
      });
    } catch {
      return {
        status: 401,
        body: { error: 'invalid_token', error_description: 'Token not found, expired, or already used' },
      };
    }

    const requestData = (request.data as Record<string, any> | null) || {};
    const requestAppId = typeof requestData.appId === 'string' ? requestData.appId : null;

    // Validate expiry and appId after consumption — if invalid, the token is still
    // marked used so it cannot be replayed.
    if (!request.accountId || request.expiresAt <= now || requestAppId !== appId) {
      return {
        status: 401,
        body: { error: 'invalid_token', error_description: 'Token not found, expired, or already used' },
      };
    }

    const { role: roleName, permissions } = await resolveAccountGrant(request.accountId, appId);

    const skey = crypto.randomBytes(32).toString('hex');

    const sessionExpSeconds = 60 * 60 * 24 * 7;
    const sessionExpiresOn = new Date();
    sessionExpiresOn.setSeconds(sessionExpiresOn.getSeconds() + sessionExpSeconds);

    const jwtExpSeconds = 60 * 7;
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    const payload: any = {
      aid: request.accountId,
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

    await prisma.applicationConnection.upsert({
      where: {
        accountId_appId: {
          accountId: request.accountId,
          appId,
        },
      },
      update: {},
      create: {
        accountId: request.accountId,
        appId,
      },
    });

    const externalSession = await prisma.authSession.create({
      data: {
        accountId: request.accountId,
        ipAddress: 'bridge',
        userAgent: 'External Application',
        lastLoggedIn: new Date(),
        loginType: externalLoginType(appId),
        validTill: sessionExpiresOn,
        key: skey,
      },
    });

    payload.sid = externalSession.id;
    payload.appId = appId;
    const signed = jwt.sign(payload, application.appSecret);

    await makeNotification({
      recipient_id: request.accountId,
      action: 'informative.application_authorized',
      message: `Application ${application.name} was authorized.`,
    });

    return {
      status: 200,
      body: {
        aid: request.accountId,
        sid: externalSession.id,
        skey,
        jwt: signed,
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
        key: skey,
        loginType: externalLoginType(appId),
        validTill: { gt: new Date() },
      },
      select: { id: true, accountId: true, validTill: true, lastLoggedIn: true },
    });

    if (!appSession) {
      return {
        status: 401,
        body: { error: 'invalid_session', error_description: 'Session not found or expired' },
      };
    }

    const { role: roleName, permissions } = await resolveAccountGrant(aid, appId);

    const sessionExpSeconds = 60 * 60 * 24 * 7;
    const newSessionExpiresOn = new Date();
    newSessionExpiresOn.setSeconds(newSessionExpiresOn.getSeconds() + sessionExpSeconds);

    const jwtExpSeconds = 60 * 7;
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    const payload: any = {
      aid,
      sid,
      appId,
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
        validTill: newSessionExpiresOn,
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
        key: skey,
        loginType: externalLoginType(appId),
        validTill: { gt: new Date() },
      },
      select: { accountId: true, validTill: true, lastLoggedIn: true },
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
        appId,
        validTill: appSession.validTill,
        lastLoggedIn: appSession.lastLoggedIn,
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_check_grant');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
