'use server';

import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sessionKey, accountId } = body || {};

    if (!sessionId || !sessionKey || !accountId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (
      !session ||
      session.accountId !== accountId ||
      session.authSessionKey !== sessionKey ||
      session.isExpired ||
      !session.expiresOn ||
      session.expiresOn < new Date()
    ) {
      return NextResponse.json({ success: false, error: 'Invalid or expired session.' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      session: {
        accountId,
        sessionId,
        expiresOn: session.expiresOn.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

