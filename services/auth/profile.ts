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
      const appSession = await prisma.appSession.findFirst({
        where: {
          id: headerSid,
          accountId: headerAid,
          sessionValue: headerSkey,
          activeTill: { gt: new Date() },
        },
      });

      if (appSession) {
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
        neupIds: {
          where: { isPrimary: true },
          take: 1,
        },
        individualProfile: true,
        brandProfile: true,
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
            neupId: account.neupIds[0]?.id,
            displayName: account.brandProfile?.brandName || account.displayName,
            displayImage: account.displayImage || 'https://neupgroup.com/assets/user.png',
            firstName: account.individualProfile?.firstName,
            middleName: account.individualProfile?.middleName,
            lastName: account.individualProfile?.lastName,
            dob: account.individualProfile?.dateOfBirth?.toISOString(),
            nationality: account.individualProfile?.countryOfResidence,
            verified: account.isVerified,
            accountType: account.accountType,
            isLegalEntity: account.brandProfile?.isLegalEntity,
            countryOfOrigin: account.brandProfile?.originCountry,
            dateEstablished: account.brandProfile?.dateCreated?.toISOString(),
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
          neupId: account.neupIds[0]?.id,
          displayName: account.brandProfile?.brandName || account.displayName,
          displayImage: account.displayImage || 'https://neupgroup.com/assets/user.png',
          verified: account.isVerified,
          accountType: account.accountType,
        },
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_get_profile');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
