import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';

const INTERNAL_APP_PREFIX = 'neup.';
const GLOBAL_RESOURCE_ID = '__app__';
const ACTIVE_MEMBER_STATUSES = new Set(['invited', 'joined']);

/**
 * Function isInternalApp.
 */
function isInternalApp(appId: string) {
  return appId.startsWith(INTERNAL_APP_PREFIX);
}


/**
 * Function normalizeResourceId.
 */
function normalizeResourceId(resourceId?: string | null) {
  if (!resourceId?.trim()) {
    return GLOBAL_RESOURCE_ID;
  }

  return resourceId.trim();
}


/**
 * Function presentResourceId.
 */
function presentResourceId(resourceId: string) {
  return resourceId === GLOBAL_RESOURCE_ID ? null : resourceId;
}


/**
 * Function mapMembership.
 */
function mapMembership(member: {
  id: string;
  parentOwnerId: string;
  memberAccountId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: member.id,
    parentOwnerId: member.parentOwnerId,
    memberAccountId: member.memberAccountId,
    status: member.status,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}


/**
 * Function mapAccountAccess.
 */
function mapAccountAccess(access: {
  id: string;
  accountId: string;
  appId: string;
  resourceId: string;
  parentOwnerId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: access.id,
    accountId: access.accountId,
    application: access.appId,
    resourceId: presentResourceId(access.resourceId),
    parentOwnerId: access.parentOwnerId,
    role: access.role,
    status: access.status,
    createdAt: access.createdAt,
    updatedAt: access.updatedAt,
  };
}


/**
 * Function hasJoinedOrInvitedMembership.
 */
async function hasJoinedOrInvitedMembership(parentOwnerId: string, memberAccountId: string) {
  if (parentOwnerId === memberAccountId) {
    return true;
  }

  const membership = await prisma.accessMember.findUnique({
    where: {
      parentOwnerId_memberAccountId: {
        parentOwnerId,
        memberAccountId,
      },
    },
  });

  return !!membership && ACTIVE_MEMBER_STATUSES.has(membership.status);
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
    const isInternal = isInternalApp(resolvedAppId);

    if (isInternal) {
      const [memberships, accessRows] = await Promise.all([
        prisma.accessMember.findMany({
          where: { memberAccountId: aid },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.accountAccess.findMany({
          where: { accountId: aid, appId: resolvedAppId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const primaryAccess =
        accessRows.find((row) => row.status === 'active' && row.resourceId === GLOBAL_RESOURCE_ID) ||
        accessRows.find((row) => row.status === 'active') ||
        null;
      const normalizedAccess = accessRows.map(mapAccountAccess);

      return {
        status: 200,
        body: {
          success: true,
          aid,
          appId: resolvedAppId,
          isInternal,
          role: primaryAccess?.role || 'user',
          teams: memberships.map(mapMembership),
          memberships: memberships.map(mapMembership),
          permissions: Array.from(new Set(accessRows.filter((row) => row.status === 'active').map((row) => row.role))),
          resourcePermissions: normalizedAccess,
          accountAccess: normalizedAccess,
          assetPermissions: normalizedAccess,
          timestamp: new Date().toISOString(),
        },
      };
    }

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
        isInternal,
        role: roleInfo?.role || 'user',
        teams: teamInfo,
        permissions: legacyPermissions?.permissions || [],
        assetPermissions,
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
    const isInternal = isInternalApp(appId);

    if (isInternal) {
      const finalParentOwnerId = typeof parentOwnerId === 'string' && parentOwnerId.trim() ? parentOwnerId.trim() : aid;
      if (finalParentOwnerId !== aid) {
        return {
          status: 403,
          body: { error: 'forbidden', error_description: 'parentOwnerId must match the authenticated primary account.' },
        };
      }

      const membership = await prisma.accessMember.upsert({
        where: {
          parentOwnerId_memberAccountId: {
            parentOwnerId: finalParentOwnerId,
            memberAccountId: recipientId,
          },
        },
        update: { status: typeof status === 'string' && status.trim() ? status.trim() : 'invited' },
        create: {
          parentOwnerId: finalParentOwnerId,
          memberAccountId: recipientId,
          status: typeof status === 'string' && status.trim() ? status.trim() : 'invited',
        },
      });

      return {
        status: 200,
        body: {
          success: true,
          message: 'Member access saved',
          member: mapMembership(membership),
        },
      };
    }

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
    const isInternal = isInternalApp(appId);
    const recipientId = targetId || aid;
    const resolvedParentOwnerId =
      typeof parentOwnerId === 'string' && parentOwnerId.trim()
        ? parentOwnerId.trim()
        : typeof ownerId === 'string' && ownerId.trim()
          ? ownerId.trim()
          : aid;
    const resolvedResourceId = normalizeResourceId(
      typeof resourceId === 'string' ? resourceId : typeof assetId === 'string' ? assetId : null
    );

    if (isInternal) {
      if (resolvedParentOwnerId !== aid) {
        return {
          status: 403,
          body: { error: 'forbidden', error_description: 'parentOwnerId must match the authenticated primary account.' },
        };
      }

      if (add || remove) {
        return {
          status: 400,
          body: {
            error: 'invalid_request',
            error_description: 'Internal apps now use role and status updates instead of add/remove permission arrays.',
          },
        };
      }

      const nextRole =
        typeof role === 'string' && role.trim()
          ? role.trim()
          : typeof update === 'string' && update.trim()
            ? update.trim()
            : null;
      const nextStatus = typeof status === 'string' && status.trim() ? status.trim() : null;

      if (!nextRole && !nextStatus) {
        return {
          status: 400,
          body: { error: 'missing_parameters', error_description: 'A role/update or status value is required.' },
        };
      }

      const hasMembership = await hasJoinedOrInvitedMembership(resolvedParentOwnerId, recipientId);
      if (!hasMembership) {
        return {
          status: 409,
          body: {
            error: 'missing_membership',
            error_description: 'Create an access_members record before granting internal app access.',
          },
        };
      }

      const uniqueAccess = {
        accountId_appId_resourceId_parentOwnerId: {
          accountId: recipientId,
          appId,
          resourceId: resolvedResourceId,
          parentOwnerId: resolvedParentOwnerId,
        },
      };

      const existingAccess = await prisma.accountAccess.findUnique({ where: uniqueAccess });

      if (!existingAccess && !nextRole) {
        return {
          status: 400,
          body: { error: 'missing_role', error_description: 'A role is required when creating a new access record.' },
        };
      }

      const savedAccess = existingAccess
        ? await prisma.accountAccess.update({
            where: uniqueAccess,
            data: {
              ...(nextRole ? { role: nextRole } : {}),
              ...(nextStatus ? { status: nextStatus } : {}),
            },
          })
        : await prisma.accountAccess.create({
            data: {
              accountId: recipientId,
              appId,
              resourceId: resolvedResourceId,
              parentOwnerId: resolvedParentOwnerId,
              role: nextRole!,
              status: nextStatus || 'active',
            },
          });

      return {
        status: 200,
        body: {
          success: true,
          access: mapAccountAccess(savedAccess),
        },
      };
    }

    if (update && typeof update === 'string') {
      await prisma.authRoleExternal.upsert({
        where: { accountId_appId: { accountId: recipientId, appId } },
        update: { role: update },
        create: { accountId: recipientId, appId, role: update },
      });
    }

    if (resourceId || assetId || parentOwnerId || ownerId) {
      const finalOwnerId = resolvedParentOwnerId;
      const finalResourceId =
        typeof resourceId === 'string' && resourceId.trim()
          ? resourceId.trim()
          : typeof assetId === 'string' && assetId.trim()
            ? assetId.trim()
            : null;

      if (add && Array.isArray(add)) {
        for (const perm of add) {
          await prisma.authPermissionRecipient.create({
            data: { appId, recipientId, ownerId: finalOwnerId, assetId: finalResourceId, permission: perm },
          });
        }
      }
      if (remove && Array.isArray(remove)) {
        await prisma.authPermissionRecipient.deleteMany({
          where: { appId, recipientId, ownerId: finalOwnerId, assetId: finalResourceId, permission: { in: remove } },
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
