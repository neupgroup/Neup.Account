'use server';

import prisma from '@/core/helpers/prisma';
import jwt from 'jsonwebtoken';
import { verifyAccountToken } from '@/core/auth/accountToken';
import { validateAuthSession, expireSession } from '@/services/auth/session';

const EXTERNAL_LOGIN_PREFIX = 'external_app:';
function externalLoginType(appId: string) {
  return `${EXTERNAL_LOGIN_PREFIX}${appId}`;
}

function resolveAppId(input: { app?: string }): string | null {
  const raw = (input.app || '').trim();
  return raw ? raw : null;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

export async function bridgeValidateToken(input: {
  token?: string;
  app?: string;
}): Promise<{ status: number; body: { success: boolean; error?: string; reason?: string } }> {
  if ((input as any).appId) {
    return { status: 400, body: { success: false, error: 'invalid_request' } };
  }
  const token = input.token?.trim();
  if (!token) {
    return { status: 400, body: { success: false, error: 'invalid_request' } };
  }

  const appId = resolveAppId(input);

  // Base account system / first-party apps: token is the RS256 auth_account cookie.
  if (!appId) {
    const payload = await verifyAccountToken(token);
    if (!payload) {
      return { status: 401, body: { success: false, error: 'invalid_grant' } };
    }

    const result = await validateAuthSession({
      aid: payload.aid,
      sid: payload.sid,
      skey: payload.skey,
    });

    if (result.status === 'valid') {
      return { status: 200, body: { success: true } };
    }

    return { status: 401, body: { success: false, error: 'invalid_grant', reason: result.reason } };
  }

  // Secondary/external apps: token is HS256 signed with Application.appSecret.
  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: { appSecret: true },
  });

  if (!application?.appSecret) {
    return { status: 404, body: { success: false, error: 'app_not_found' } };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, application.appSecret);
  } catch {
    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  const aid = typeof decoded?.aid === 'string' ? decoded.aid : null;
  const sid = typeof decoded?.sid === 'string' ? decoded.sid : null;
  const tokenAppId = typeof decoded?.appId === 'string' ? decoded.appId : null;

  if (!aid || !sid || (tokenAppId && tokenAppId !== appId)) {
    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  const session = await prisma.authnSession.findFirst({
    where: {
      id: sid,
      accountId: aid,
      loginType: externalLoginType(appId),
      validTill: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!session) {
    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  return { status: 200, body: { success: true } };
}

// ---------------------------------------------------------------------------
// Expire
// ---------------------------------------------------------------------------

export async function bridgeExpireToken(input: {
  token?: string;
  app?: string;
}): Promise<{ status: number; body: { success: boolean; error?: string; message?: string } }> {
  if ((input as any).appId) {
    return { status: 400, body: { success: false, error: 'invalid_request' } };
  }
  const token = input.token?.trim();
  if (!token) {
    return { status: 400, body: { success: false, error: 'invalid_request' } };
  }

  const appId = resolveAppId(input);

  // Base account system / first-party apps: token is the RS256 auth_account cookie.
  if (!appId) {
    const payload = await verifyAccountToken(token);
    if (!payload) {
      return { status: 401, body: { success: false, error: 'invalid_grant' } };
    }

    const result = await expireSession({
      aid: payload.aid,
      sid: payload.sid,
      skey: payload.skey,
    });

    if (result.success) {
      return { status: 200, body: { success: true, message: 'Signed out successfully.' } };
    }

    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  // Secondary/external apps: token is HS256 signed with Application.appSecret.
  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: { appSecret: true },
  });

  if (!application?.appSecret) {
    return { status: 404, body: { success: false, error: 'app_not_found' } };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, application.appSecret);
  } catch {
    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  const aid = typeof decoded?.aid === 'string' ? decoded.aid : null;
  const sid = typeof decoded?.sid === 'string' ? decoded.sid : null;
  const tokenAppId = typeof decoded?.appId === 'string' ? decoded.appId : null;

  if (!aid || !sid || (tokenAppId && tokenAppId !== appId)) {
    return { status: 401, body: { success: false, error: 'invalid_grant' } };
  }

  try {
    await prisma.authnSession.updateMany({
      where: {
        id: sid,
        accountId: aid,
        loginType: externalLoginType(appId),
        validTill: { gt: new Date() },
      },
      data: { validTill: new Date() },
    });
  } catch {
    return { status: 500, body: { success: false, error: 'internal_server_error' } };
  }

  return { status: 200, body: { success: true, message: 'Signed out successfully.' } };
}
