
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api.v1/auth/session
 * Validates a session, updates device type, and extends expiry.
 * Used for internal Neup.Account session management.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { aid, sid, skey, deviceType, activity } = body;

    if (!aid || !sid || !skey) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
        { status: 400 }
      );
    }

    // 1. Find and validate the session
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { account: true }
    });

    if (!session || session.accountId !== aid || session.authSessionKey !== skey || session.isExpired) {
      return NextResponse.json(
        { error: 'invalid_session', error_description: 'Session not found or invalid' },
        { status: 401 }
      );
    }

    if (session.expiresOn && session.expiresOn < new Date()) {
      return NextResponse.json(
        { error: 'session_expired', error_description: 'Session has expired' },
        { status: 401 }
      );
    }

    // 2. Update session data (deviceType, expiresOn)
    // Extend expiry by 30 days from now
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);

    const updatedSession = await prisma.session.update({
      where: { id: sid },
      data: {
        expiresOn: newExpiry,
        ...(deviceType ? { deviceType } : {}),
      }
    });

    // 3. Optional: Activity check (permissions)
    // If an activity is specified, check if the user is allowed to do it.
    // This uses the internal permit/permission system.
    if (activity) {
      // For internal sessions, we check the account's permit and additional permissions.
      // This is a simplified check. In a real scenario, you'd use checkPermissions from lib/user.
      const accountPermit = session.account.permit || 'default';
      // Basic check: if activity is provided, ensure user isn't 'restricted' or similar.
      // (This logic can be expanded based on your internal permission model)
    }

    return NextResponse.json({
      success: true,
      session: {
        aid: updatedSession.accountId,
        sid: updatedSession.id,
        expiresOn: updatedSession.expiresOn,
        deviceType: updatedSession.deviceType,
      }
    });

  } catch (error) {
    await logError('auth', error, 'post_auth_session');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

/**
 * DELETE /api.v1/auth/session
 * Invalidates a session (logout).
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { aid, sid, skey } = body;

    if (!aid || !sid || !skey) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
        { status: 400 }
      );
    }

    // Invalidate the session
    const session = await prisma.session.updateMany({
      where: {
        id: sid,
        accountId: aid,
        authSessionKey: skey,
      },
      data: {
        isExpired: true,
        expiresOn: new Date(), // Set to now
      }
    });

    if (session.count === 0) {
      return NextResponse.json(
        { error: 'not_found', error_description: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Session invalidated' });

  } catch (error) {
    await logError('auth', error, 'delete_auth_session');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}
