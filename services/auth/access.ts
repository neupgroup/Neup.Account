import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

const INTERNAL_APP_PREFIX = 'neup.';

/**
 * Function isInternalApp.
 */
function isInternalApp(appId: string) {
  return appId.startsWith(INTERNAL_APP_PREFIX);
}




/**
 * Function bridgeGetAuthAccess.
 */
export async function bridgeGetAuthAccess(input: {
  aid?: string | null;
  sid?: string | null;
  skey?: string | null;
  appId?: string | null;
}): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, sid, skey, appId } = input;

  if (!aid || !sid || !skey) {
    return {
      status: 400,
      body: { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
    };
  }

  try {
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        ...(appId ? { appId } : {}),
        expiresOn: { gt: new Date() },
      },
    });

    if (!externalSession) {
      return {
        status: 401,
        body: { error: 'invalid_session', error_description: 'Session not found or expired' },
      };
    }

    const resolvedAppId = externalSession.appId;
    const roleInfo = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId: resolvedAppId } },
    });

    const teamInfo = await prisma.authTeamExternal.findMany({
      where: { recipientId: aid, appId: resolvedAppId },
    });

    const legacyPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId: resolvedAppId } },
    });

    const assetPermissions = await prisma.authPermissionRecipient.findMany({
      where: { recipientId: aid, appId: resolvedAppId },
    });

    return {
      status: 200,
      body: {
        success: true,
        aid,
        appId: resolvedAppId,
        isInternal: isInternalApp(resolvedAppId),
        role: roleInfo?.role || 'user',
        teams: teamInfo,
        permissions: legacyPermissions?.permissions || [],
        assetPermissions,
        resourcePermissions: assetPermissions,
        accountAccess: assetPermissions,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    await logError('auth', error, 'bridge_get_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}


/**
 * Function bridgeCreateAuthAccess.
 */
export async function bridgeCreateAuthAccess(input: Record<string, any>): Promise<{ status: number; body: Record<string, any> }> {
  const { aid, sid, skey, recipientId, isPermanent, status, parentOwnerId, appId: appIdOverride } = input;

  if (!aid || !sid || !skey || !recipientId) {
    return { status: 400, body: { error: 'missing_parameters' } };
  }

  try {
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } },
    });

    if (!session) return { status: 401, body: { error: 'unauthorized' } };

    const appId = appIdOverride || session.appId;

    await prisma.authTeamExternal.upsert({
      where: { appId_accountId_recipientId: { appId, accountId: aid, recipientId } },
      update: { isPermanent: !!isPermanent },
      create: { appId, accountId: aid, recipientId, isPermanent: !!isPermanent },
    });

    return { status: 200, body: { success: true, message: 'User added to team' } };
  } catch (error) {
    await logError('auth', error, 'bridge_create_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}


/**
 * Function bridgeUpdateAuthAccess.
 */
export async function bridgeUpdateAuthAccess(input: Record<string, any>): Promise<{ status: number; body: Record<string, any> }> {
  const {
    aid,
    sid,
    skey,
    update,
    role,
    status,
    add,
    remove,
    resourceId,
    assetId,
    parentOwnerId,
    ownerId,
    recipientId: targetId,
  } = input;

  try {
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } },
    });

    if (!session) return { status: 401, body: { error: 'unauthorized' } };

    const appId = session.appId;
    const recipientId = targetId || aid;
    const resolvedParentOwnerId =
      typeof parentOwnerId === 'string' && parentOwnerId.trim()
        ? parentOwnerId.trim()
        : typeof ownerId === 'string' && ownerId.trim()
          ? ownerId.trim()
          : aid;
    const resolvedResourceId = typeof resourceId === 'string' && resourceId.trim()
      ? resourceId.trim()
      : typeof assetId === 'string' && assetId.trim()
        ? assetId.trim()
        : null;

    if (update && typeof update === 'string') {
      await prisma.authRoleExternal.upsert({
        where: { accountId_appId: { accountId: recipientId, appId } },
        update: { role: update },
        create: { accountId: recipientId, appId, role: update },
      });
    }

    if (resourceId || assetId || parentOwnerId || ownerId) {
      const finalOwnerId = resolvedParentOwnerId;

      if (add && Array.isArray(add)) {
        for (const perm of add) {
          await prisma.authPermissionRecipient.create({
            data: { appId, recipientId, ownerId: finalOwnerId, assetId: resolvedResourceId, permission: perm },
          });
        }
      }
      if (remove && Array.isArray(remove)) {
        await prisma.authPermissionRecipient.deleteMany({
          where: { appId, recipientId, ownerId: finalOwnerId, assetId: resolvedResourceId, permission: { in: remove } },
        });
      }
    } else if (add || remove) {
      const existing = await prisma.authPermissionsExternal.findUnique({
        where: { accountId_appId: { accountId: recipientId, appId } },
      });
      let perms = (existing?.permissions as string[]) || [];
      if (add) perms = Array.from(new Set([...perms, ...(Array.isArray(add) ? add : [add])]));
      if (remove) perms = perms.filter((p) => !(Array.isArray(remove) ? remove : [remove]).includes(p));

      await prisma.authPermissionsExternal.upsert({
        where: { accountId_appId: { accountId: recipientId, appId } },
        update: { permissions: perms },
        create: { accountId: recipientId, appId, permissions: perms },
      });
    }

    return { status: 200, body: { success: true } };
  } catch (error) {
    await logError('auth', error, 'bridge_update_auth_access');
    return { status: 500, body: { error: 'internal_server_error' } };
  }
}
