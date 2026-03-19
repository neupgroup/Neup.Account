
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempToken, appId } = body;

    if (!tempToken || !appId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing tempToken or appId' },
        { status: 400 }
      );
    }

    // 1. Find the session that contains this tempToken in its dependentKeys
    const sessions = await prisma.session.findMany({
      where: {
        isExpired: false,
        expiresOn: { gt: new Date() },
      },
      include: {
        account: true,
      }
    });

    const sessionWithToken = sessions.find(s => {
      if (!Array.isArray(s.dependentKeys)) return false;
      return (s.dependentKeys as any[]).some(
        (k: any) => k.app === appId && k.key === tempToken && !k.isUsed
      );
    });

    if (!sessionWithToken) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token not found, expired, or already used' },
        { status: 401 }
      );
    }

    // 2. Extract and validate the token from dependentKeys
    const dependentKeys = sessionWithToken.dependentKeys as any[];
    const tokenIndex = dependentKeys.findIndex(
      (k: any) => k.app === appId && k.key === tempToken && !k.isUsed
    );

    if (tokenIndex === -1) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token validation failed' },
        { status: 401 }
      );
    }

    const tokenData = dependentKeys[tokenIndex];
    if (new Date(tokenData.expiresOn) < new Date()) {
      return NextResponse.json(
        { error: 'token_expired', error_description: 'Token has expired' },
        { status: 401 }
      );
    }

    // 3. Mark the token as used
    dependentKeys[tokenIndex].isUsed = true;
    await prisma.session.update({
      where: { id: sessionWithToken.id },
      data: { dependentKeys },
    });

    // 4. Get Role and Permissions for this app
    const externalRole = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: sessionWithToken.accountId, appId } },
    });

    const externalPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: sessionWithToken.accountId, appId } },
    });

    const roleName = externalRole?.role || 'user';
    const permissions = (externalPermissions?.permissions as string[]) || [];

    // 5. Generate Session IDs for External App
    const sid = crypto.randomUUID();
    const skey = crypto.randomBytes(32).toString('hex');
    
    // Session (sid, skey, aid) lasts 7 days
    const sessionExpSeconds = 60 * 60 * 24 * 7; 
    const sessionExpiresOn = new Date();
    sessionExpiresOn.setSeconds(sessionExpiresOn.getSeconds() + sessionExpSeconds);

    // JWT lasts 7 minutes
    const jwtExpSeconds = 60 * 7; 
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    // 6. Generate JWT
    const payload: any = {
      aid: sessionWithToken.accountId,
      role: roleName,
      iat,
      exp: jwtExp,
    };

    if (externalRole?.hasExtra) {
      payload.per = permissions;
    }

    // Use appSecret as the signing key for the JWT
    const application = await prisma.application.findUnique({
      where: { id: appId },
    });

    if (!application || !application.appSecret) {
        return NextResponse.json(
            { error: 'invalid_app', error_description: 'Application configuration error' },
            { status: 500 }
        );
    }

    const token = jwt.sign(payload, application.appSecret);

    // 7. Store the external session (stored with 7-day expiry)
    await prisma.authSessionExternal.create({
      data: {
        id: sid,
        accountId: sessionWithToken.accountId,
        appId: appId,
        sessionId: sessionWithToken.id,
        sessionKey: skey,
        jwt: token,
        expiresOn: sessionExpiresOn,
      },
    });

    // 8. Return response
    return NextResponse.json({
      aid: sessionWithToken.accountId,
      sid: sid,
      skey: skey,
      jwt: token,
      exp: jwtExp, // Return JWT expiry for the token
      role: roleName,
      ...(externalRole?.hasExtra ? { per: permissions } : {}),
    });

  } catch (error) {
    await logError('auth', error, 'external_auth_grant');
    console.error('External auth grant error:', error);
    return NextResponse.json(
      { error: 'internal_server_error', error_description: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sid, aid, skey, appId } = body;

    if (!sid || !aid || !skey || !appId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing sid, aid, skey, or appId' },
        { status: 400 }
      );
    }

    // 1. Find the existing external session
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        appId: appId,
        expiresOn: { gt: new Date() },
      },
      include: {
        application: true,
      }
    });

    if (!externalSession) {
      return NextResponse.json(
        { error: 'invalid_session', error_description: 'Session not found or expired' },
        { status: 401 }
      );
    }

    // 2. Get Role and Permissions for this app
    const externalRole = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } },
    });

    const externalPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } },
    });

    const roleName = externalRole?.role || 'user';
    const permissions = (externalPermissions?.permissions as string[]) || [];

    // 3. Generate New Expiry and JWT
    // Session (sid, skey, aid) lasts 7 days from now
    const sessionExpSeconds = 60 * 60 * 24 * 7; 
    const newSessionExpiresOn = new Date();
    newSessionExpiresOn.setSeconds(newSessionExpiresOn.getSeconds() + sessionExpSeconds);

    // JWT lasts 7 minutes from now
    const jwtExpSeconds = 60 * 7; 
    const iat = Math.floor(Date.now() / 1000);
    const jwtExp = iat + jwtExpSeconds;

    const payload: any = {
      aid: aid,
      role: roleName,
      iat,
      exp: jwtExp,
    };

    if (externalRole?.hasExtra) {
      payload.per = permissions;
    }

    if (!externalSession.application.appSecret) {
      return NextResponse.json(
        { error: 'invalid_app', error_description: 'Application configuration error' },
        { status: 500 }
      );
    }

    const newToken = jwt.sign(payload, externalSession.application.appSecret);

    // 4. Update the external session
    await prisma.authSessionExternal.update({
      where: { id: sid },
      data: {
        jwt: newToken,
        expiresOn: newSessionExpiresOn,
      },
    });

    // 5. Return updated session info
    return NextResponse.json({
      aid: aid,
      sid: sid,
      jwt: newToken,
      exp: jwtExp,
      role: roleName,
      ...(externalRole?.hasExtra ? { per: permissions } : {}),
    });

  } catch (error) {
    await logError('auth', error, 'external_auth_refresh');
    console.error('External auth refresh error:', error);
    return NextResponse.json(
      { error: 'internal_server_error', error_description: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * GET /api.v1/auth/grant
 * Checks if the authentication grant is still valid.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const aid = searchParams.get('aid');
    const sid = searchParams.get('sid');
    const skey = searchParams.get('skey');
    const appId = searchParams.get('appId');

    if (!aid || !sid || !skey || !appId) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing aid, sid, skey, or appId' },
        { status: 400 }
      );
    }

    // 1. Verify via AuthSessionExternal
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        appId: appId,
        expiresOn: { gt: new Date() },
      }
    });

    if (!externalSession) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Grant not found or expired' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      aid: externalSession.accountId,
      appId: externalSession.appId,
      expiresOn: externalSession.expiresOn,
      lastLoggedIn: externalSession.createdAt,
    });

  } catch (error) {
    await logError('auth', error, 'get_auth_grant');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}
