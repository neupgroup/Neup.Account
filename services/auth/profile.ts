import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

/**
 * Function bridgeGetProfile.
 */
export async function bridgeGetProfile(input: {
  searchParams: URLSearchParams;
  headers: Headers;
  body?: any;
}): Promise<{ status: number; body: Record<string, any> }> {
  try {
    const { searchParams, headers, body } = input;

    const headerAid = headers.get('aid');
    const headerSid = headers.get('sid');
    const headerSkey = headers.get('skey');

    const tempToken = searchParams.get('tempToken');
    const appId = searchParams.get('appId');

    let requestedAid = searchParams.get('aid');
    let requestedNeupId = searchParams.get('neupid');

    if (body && typeof body === 'object') {
      requestedAid = body.aid || requestedAid;
      requestedNeupId = body.neupid || requestedNeupId;
    }

    let authenticatedAccountId: string | null = null;
    let isTempTokenAuth = false;

    if (headerAid && headerSid && headerSkey) {
      const externalSession = await prisma.authSessionExternal.findFirst({
        where: {
          id: headerSid,
          accountId: headerAid,
          sessionKey: headerSkey,
          expiresOn: { gt: new Date() },
        },
      });

      if (externalSession) {
        authenticatedAccountId = headerAid;
      }
    } else if (tempToken && appId) {
      const sessions = await prisma.session.findMany({
        where: {
          isExpired: false,
          expiresOn: { gt: new Date() },
        },
      });

      const sessionWithToken = sessions.find((s) => {
        if (!Array.isArray(s.dependentKeys)) return false;
        return (s.dependentKeys as any[]).some((k: any) => k.app === appId && k.key === tempToken && !k.isUsed);
      });

      if (sessionWithToken) {
        const dependentKeys = sessionWithToken.dependentKeys as any[];
        const tokenData = dependentKeys.find((k: any) => k.app === appId && k.key === tempToken && !k.isUsed);

        if (tokenData && new Date(tokenData.expiresOn) > new Date()) {
          authenticatedAccountId = sessionWithToken.accountId;
          isTempTokenAuth = true;
        }
      }
    }

    if (!authenticatedAccountId) {
      return {
        status: 401,
        body: { error: 'unauthorized', error_description: 'Authentication failed' },
      };
    }

    let targetAccountId: string | null = null;

    if (requestedAid) {
      targetAccountId = requestedAid;
    } else if (requestedNeupId) {
      const neupIdRecord = await prisma.neupId.findUnique({
        where: { id: requestedNeupId },
      });
      targetAccountId = neupIdRecord?.accountId || null;
    } else {
      targetAccountId = authenticatedAccountId;
    }

    if (!targetAccountId) {
      return {
        status: 404,
        body: { error: 'not_found', error_description: 'Requested user not found' },
      };
    }

    const account = await prisma.account.findUnique({
      where: { id: targetAccountId },
      include: {
        contacts: true,
      },
    });

    if (!account) {
      return {
        status: 404,
        body: { error: 'not_found', error_description: 'User profile not found' },
      };
    }

    const isSelf = targetAccountId === authenticatedAccountId;

    if (isSelf || isTempTokenAuth) {
      const emails = account.contacts.filter((c) => c.contactType === 'email').map((c) => c.value);
      const phones = account.contacts.filter((c) => c.contactType === 'phone').map((c) => c.value);

      return {
        status: 200,
        body: {
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
            emails,
            phones,
            contacts: account.contacts.map((c) => ({ type: c.contactType, value: c.value })),
          },
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        profile: {
          aid: account.id,
          neupId: account.neupIdPrimary,
          displayName: account.displayName || account.nameDisplay,
          displayImage: account.accountPhoto || 'https://neupgroup.com/assets/user.png',
          verified: account.verified,
          accountType: account.accountType,
        },
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_get_profile');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
