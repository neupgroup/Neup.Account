import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /bridge/api.v1/account/registerApp?account=[accountId]&application=[applicationId]
 *
 * Registers a connection between an account and an application.
 * Creates an entry in application_connection if one does not already exist.
 *
 * Query params:
 *   account     - The account ID to connect
 *   application - The application ID to connect to
 *
 * Response:
 *   201 { success: true, created: true }   — new connection created
 *   200 { success: true, created: false }  — connection already existed
 *   400 { success: false, error: string }  — missing or invalid params
 *   404 { success: false, error: string }  — account or application not found
 *   500 { success: false, error: string }  — internal error
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const accountId = searchParams.get('account');
  const appId = searchParams.get('application');

  if (!accountId || !appId) {
    return NextResponse.json(
      { success: false, error: 'Missing required query params: account, application.' },
      { status: 400 },
    );
  }

  try {
    // Verify both the account and application exist
    const [account, application] = await Promise.all([
      prisma.account.findUnique({ where: { id: accountId }, select: { id: true } }),
      prisma.application.findUnique({ where: { id: appId }, select: { id: true } }),
    ]);

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found.' },
        { status: 404 },
      );
    }

    if (!application) {
      return NextResponse.json(
        { success: false, error: 'Application not found.' },
        { status: 404 },
      );
    }

    // Check if the connection already exists
    const existing = await prisma.applicationConnection.findUnique({
      where: { accountId_appId: { accountId, appId } },
      select: { id: true, status: true },
    });

    if (existing) {
      // If the connection was previously in 'inactive_invited' state, the user
      // has now actively connected — upgrade to 'active'.
      if (existing.status === 'inactive_invited') {
        await prisma.applicationConnection.update({
          where: { accountId_appId: { accountId, appId } },
          data: { status: 'active' },
        });
      }
      return NextResponse.json({ success: true, created: false }, { status: 200 });
    }

    // Create the new connection — status 'active' because the application
    // called this endpoint, meaning the account exists and is live.
    await prisma.applicationConnection.create({
      data: { accountId, appId, status: 'active' },
    });

    return NextResponse.json({ success: true, created: true }, { status: 201 });
  } catch (error) {
    await logError('database', error, `registerApp:${accountId}:${appId}`);
    return NextResponse.json(
      { success: false, error: 'Failed to register application connection.' },
      { status: 500 },
    );
  }
}
