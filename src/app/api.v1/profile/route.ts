
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api.v1/profile
 * Retrieves user profile information based on authentication.
 * Supports header-based session authentication and tempToken-based authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const headers = request.headers;

    // 1. Extract Authentication Credentials
    // Header-based (External App Sessions)
    const headerAid = headers.get('aid');
    const headerSid = headers.get('sid');
    const headerSkey = headers.get('skey');

    // Query-based (Temp Token / Initial Grant)
    const tempToken = searchParams.get('tempToken');
    const appId = searchParams.get('appId');

    // Requested Profile (Query Params - standard for GET)
    let requestedAid = searchParams.get('aid');
    let requestedNeupId = searchParams.get('neupid');

    // Attempt to read from body if provided (non-standard for GET but requested)
    try {
      if (request.headers.get('content-type')?.includes('application/json')) {
        const body = await request.json();
        requestedAid = body.aid || requestedAid;
        requestedNeupId = body.neupid || requestedNeupId;
      }
    } catch (e) {
      // Ignore body parsing errors for GET
    }

    let authenticatedAccountId: string | null = null;
    let isTempTokenAuth = false;

    // 2. Perform Authentication
    if (headerAid && headerSid && headerSkey) {
      // Verify via AuthSessionExternal
      const externalSession = await prisma.authSessionExternal.findFirst({
        where: {
          id: headerSid,
          accountId: headerAid,
          sessionKey: headerSkey,
          expiresOn: { gt: new Date() },
        }
      });

      if (externalSession) {
        authenticatedAccountId = headerAid;
      }
    } else if (tempToken && appId) {
      // Verify via tempToken in Session dependentKeys
      const sessions = await prisma.session.findMany({
        where: {
          isExpired: false,
          expiresOn: { gt: new Date() },
        }
      });

      const sessionWithToken = sessions.find(s => {
        if (!Array.isArray(s.dependentKeys)) return false;
        return (s.dependentKeys as any[]).some(
          (k: any) => k.app === appId && k.key === tempToken && !k.isUsed
        );
      });

      if (sessionWithToken) {
        const dependentKeys = sessionWithToken.dependentKeys as any[];
        const tokenData = dependentKeys.find(
          (k: any) => k.app === appId && k.key === tempToken && !k.isUsed
        );

        if (tokenData && new Date(tokenData.expiresOn) > new Date()) {
          authenticatedAccountId = sessionWithToken.accountId;
          isTempTokenAuth = true;

          // Note: We don't mark as used here yet, as profile might be requested multiple times 
          // during the initial handshake, but typically it's used once.
          // For now, we'll keep it available for the profile call.
        }
      }
    }

    if (!authenticatedAccountId) {
      return NextResponse.json(
        { error: 'unauthorized', error_description: 'Authentication failed' },
        { status: 401 }
      );
    }

    // 3. Resolve Requested Account
    let targetAccountId: string | null = null;

    if (requestedAid) {
      targetAccountId = requestedAid;
    } else if (requestedNeupId) {
      const neupIdRecord = await prisma.neupId.findUnique({
        where: { id: requestedNeupId }
      });
      targetAccountId = neupIdRecord?.accountId || null;
    } else {
      // Default to self if no target specified
      targetAccountId = authenticatedAccountId;
    }

    if (!targetAccountId) {
      return NextResponse.json(
        { error: 'not_found', error_description: 'Requested user not found' },
        { status: 404 }
      );
    }

    // 4. Fetch Profile Data
    const account = await prisma.account.findUnique({
      where: { id: targetAccountId },
      include: {
        contacts: true,
      }
    });

    if (!account) {
      return NextResponse.json(
        { error: 'not_found', error_description: 'User profile not found' },
        { status: 404 }
      );
    }

    const isSelf = targetAccountId === authenticatedAccountId;

    // 5. Build Response based on Privacy
    if (isSelf || isTempTokenAuth) {
      // Full Profile (for self or during initial grant with tempToken)
      const emails = account.contacts.filter(c => c.contactType === 'email').map(c => c.value);
      const phones = account.contacts.filter(c => c.contactType === 'phone').map(c => c.value);

      return NextResponse.json({
        success: true,
        profile: {
          aid: account.id,
          neupId: account.neupIdPrimary,
          displayName: account.displayName || account.nameDisplay,
          displayImage: account.accountPhoto || 'https://neupgroup.com/assets/user.png',
          firstName: account.nameFirst,
          middleName: account.nameMiddle,
          lastName: account.nameLast,
          gender: account.gender,
          dob: account.dateBirth?.toISOString(),
          nationality: account.nationality,
          verified: account.verified,
          accountType: account.accountType,
          isLegalEntity: account.isLegalEntity,
          nameLegal: account.nameLegal,
          registrationId: account.registrationId,
          countryOfOrigin: account.countryOfOrigin,
          dateEstablished: account.dateEstablished?.toISOString(),
          emails: emails,
          phones: phones,
          contacts: account.contacts.map(c => ({ type: c.contactType, value: c.value }))
        }
      });
    } else {
      // Limited Profile (for someone else)
      return NextResponse.json({
        success: true,
        profile: {
          aid: account.id,
          neupId: account.neupIdPrimary,
          displayName: account.displayName || account.nameDisplay,
          displayImage: account.accountPhoto || 'https://neupgroup.com/assets/user.png',
          verified: account.verified,
          accountType: account.accountType
        }
      });
    }

  } catch (error) {
    await logError('auth', error, 'get_profile_api');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}
