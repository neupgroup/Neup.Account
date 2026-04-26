import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

const INTERNAL_APP_PREFIX = 'neup.';

function isInternalApp(appId: string) {
  return appId.startsWith(INTERNAL_APP_PREFIX);
}

async function resolveSession(input: { aid?: string | null; sid?: string | null; skey?: string | null; appId?: string | null }) {
  const { aid, sid, skey } = input;
  if (!aid || !sid || !skey) return null;

  return prisma.authSession.findFirst({
    where: {
      id: sid,
      accountId: aid,
      key: skey,
      validTill: { gt: new Date() },
    },
  });
}

export async function bridgeGetAuthAccess(input: {
  aid?: string | null;
  sid?: string | null;
  skey?: string | null;
  appId?: string | null;
}): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, appId } = input;

  if (!aid || !input.sid || !input.skey) {
    return {
      status: 400,
      body: { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
    };
  }

  try {
    const session = await resolveSession(input);
    if (!session) {
      return {
        status: 401,
        body: { error: 'invalid_session', error_description: 'Session not found or expired' },
      };
    }

    const resolvedAppId = appId || 'neup.account';

    const [teamInfo, roleRows] = await Promise.all([
      prisma.portfolioMember.findMany({
        where: {
          accountId: aid,
          portfolio: {
            assets: {
              some: {
                assetId: resolvedAppId,
                assetType: { in: ['application', 'app'] },
              },
            },
          },
        },
        select: {
          id: true,
          portfolioId: true,
          accountId: true,
          details: true,
        },
      }),
      prisma.portfolioRole.findMany({
        where: {
          accountId: aid,
          portfolio: {
            assets: {
              some: {
                assetId: resolvedAppId,
                assetType: { in: ['application', 'app'] },
              },
            },
          },
        },
        select: { roleId: true },
      }),
    ]);

    const permissions = Array.from(new Set(roleRows.map((row) => row.roleId)));

    return {
      status: 200,
      body: {
        success: true,
        aid,
        appId: resolvedAppId,
        isInternal: isInternalApp(resolvedAppId),
        role: 'user',
        teams: teamInfo,
        permissions,
        assetPermissions: [],
        resourcePermissions: [],
        accountAccess: [],
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_get_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}

export async function bridgeCreateAuthAccess(input: Record<string, any>): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, sid, skey, recipientId, isPermanent, appId: appIdOverride } = input;

  if (!aid || !sid || !skey || !recipientId) {
    return { status: 400, body: { error: 'missing_parameters' } };
  }

  try {
    const session = await resolveSession({ aid, sid, skey, appId: appIdOverride || null });
    if (!session) return { status: 401, body: { error: 'unauthorized' } };

    const appId = appIdOverride || 'neup.account';

    await prisma.$transaction(async (tx) => {
      let portfolio = await tx.portfolio.findFirst({
        where: {
          assets: {
            some: {
              assetId: appId,
              assetType: { in: ['application', 'app'] },
            },
          },
        },
        select: { id: true },
      });

      if (!portfolio) {
        portfolio = await tx.portfolio.create({
          data: {
            name: `App Portfolio ${appId}`,
            description: 'Auto-generated app portfolio for access management.',
            assets: {
              create: {
                assetId: appId,
                assetType: 'application',
                details: { primaryPortfolio: true },
              },
            },
          },
          select: { id: true },
        });
      }

      await tx.portfolioMember.upsert({
        where: {
          portfolioId_accountId: {
            portfolioId: portfolio.id,
            accountId: recipientId,
          },
        },
        update: {
          details: {
            isPermanent: !!isPermanent,
          },
        },
        create: {
          portfolioId: portfolio.id,
          accountId: recipientId,
          details: {
            isPermanent: !!isPermanent,
          },
        },
      });
    });

    return { status: 200, body: { success: true, message: 'User added to portfolio.' } };
  } catch (error) {
    await logError('auth', error, 'bridge_create_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}

export async function bridgeUpdateAuthAccess(input: Record<string, any>): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, sid, skey, add, remove, appId: appIdOverride, recipientId: targetId } = input;

  try {
    const session = await resolveSession({ aid, sid, skey, appId: appIdOverride || null });
    if (!session || !aid) return { status: 401, body: { error: 'unauthorized' } };

    const appId = appIdOverride || 'neup.account';
    const recipientId = targetId || aid;

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        assets: {
          some: {
            assetId: appId,
            assetType: { in: ['application', 'app'] },
          },
        },
      },
      select: { id: true },
    });

    if (!portfolio) {
      return { status: 404, body: { error: 'portfolio_not_found' } };
    }

    const addRoles = Array.isArray(add) ? add : add ? [add] : [];
    const removeRoles = Array.isArray(remove) ? remove : remove ? [remove] : [];

    await prisma.$transaction(async (tx) => {
      if (removeRoles.length > 0) {
        await tx.portfolioRole.deleteMany({
          where: {
            accountId: recipientId,
            portfolioId: portfolio.id,
            roleId: { in: removeRoles },
          },
        });
      }

      for (const roleId of addRoles) {
        await tx.portfolioRole.upsert({
          where: {
            accountId_portfolioId_roleId: {
              accountId: recipientId,
              portfolioId: portfolio.id,
              roleId,
            },
          },
          update: {},
          create: {
            accountId: recipientId,
            portfolioId: portfolio.id,
            roleId,
          },
        });
      }
    });

    return { status: 200, body: { success: true } };
  } catch (error) {
    await logError('auth', error, 'bridge_update_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
