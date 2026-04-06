
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const INTERNAL_APP_PREFIX = 'neup.';
const GLOBAL_RESOURCE_ID = '__app__';
const ACTIVE_MEMBER_STATUSES = new Set(['invited', 'joined']);

function isInternalApp(appId: string) {
  return appId.startsWith(INTERNAL_APP_PREFIX);
}

function normalizeResourceId(resourceId?: string | null) {
  if (!resourceId?.trim()) {
    return GLOBAL_RESOURCE_ID;
  }

  return resourceId.trim();
}

function presentResourceId(resourceId: string) {
  return resourceId === GLOBAL_RESOURCE_ID ? null : resourceId;
}

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

async function hasJoinedOrInvitedMembership(parentOwnerId: string, memberAccountId: string) {
  if (parentOwnerId === memberAccountId) {
    return true;
  }

  const membership = await prisma.accessMember.findUnique({
    where: {
      parentOwnerId_memberAccountId: {
        parentOwnerId,
        memberAccountId,
      }
    }
  });

  return !!membership && ACTIVE_MEMBER_STATUSES.has(membership.status);
}

/**
 * GET /bridge/api.v1/auth/access
 * Retrieves roles, permissions, and team information for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const aid = searchParams.get('aid');
    const sid = searchParams.get('sid');
    const skey = searchParams.get('skey');
    const appIdFromQuery = searchParams.get('appId');

    if (!aid || !sid || !skey) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing aid, sid, or skey' },
        { status: 400 }
      );
    }

    // 1. Verify session (check external sessions table)
    const externalSession = await prisma.authSessionExternal.findFirst({
      where: {
        id: sid,
        accountId: aid,
        sessionKey: skey,
        ...(appIdFromQuery ? { appId: appIdFromQuery } : {}),
        expiresOn: { gt: new Date() },
      }
    });

    if (!externalSession) {
      return NextResponse.json(
        { error: 'invalid_session', error_description: 'Session not found or expired' },
        { status: 401 }
      );
    }

    const appId = externalSession.appId;
    const isInternal = isInternalApp(appId);

    if (isInternal) {
      const [memberships, accessRows] = await Promise.all([
        prisma.accessMember.findMany({
          where: { memberAccountId: aid },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.accountAccess.findMany({
          where: { accountId: aid, appId },
          orderBy: { createdAt: 'desc' }
        }),
      ]);

      const primaryAccess =
        accessRows.find((row) => row.status === 'active' && row.resourceId === GLOBAL_RESOURCE_ID) ||
        accessRows.find((row) => row.status === 'active') ||
        null;
      const normalizedAccess = accessRows.map(mapAccountAccess);

      return NextResponse.json({
        success: true,
        aid,
        appId,
        isInternal,
        role: primaryAccess?.role || 'user',
        teams: memberships.map(mapMembership),
        memberships: memberships.map(mapMembership),
        permissions: Array.from(new Set(accessRows.filter((row) => row.status === 'active').map((row) => row.role))),
        resourcePermissions: normalizedAccess,
        accountAccess: normalizedAccess,
        assetPermissions: normalizedAccess,
        timestamp: new Date().toISOString()
      });
    }

    // 2. Fetch Roles
    const roleInfo = await prisma.authRoleExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } }
    });

    // 3. Fetch Team Membership
    const teamInfo = await prisma.authTeamExternal.findMany({
      where: { recipientId: aid, appId }
    });

    // 4. Fetch Direct Permissions (Legacy/Simple)
    const legacyPermissions = await prisma.authPermissionsExternal.findUnique({
      where: { accountId_appId: { accountId: aid, appId } }
    });

    // 5. Fetch Asset/Recipient Permissions
    const assetPermissions = await prisma.authPermissionRecipient.findMany({
      where: { recipientId: aid, appId }
    });

    return NextResponse.json({
      success: true,
      aid,
      appId,
      isInternal,
      role: roleInfo?.role || 'user',
      teams: teamInfo,
      permissions: legacyPermissions?.permissions || [],
      assetPermissions: assetPermissions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError('auth', error, 'get_auth_access');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

/**
 * POST /bridge/api.v1/auth/access
 * Adds a user to the auth team (Admin/Manager role).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      aid,
      sid,
      skey,
      recipientId,
      isPermanent,
      status,
      parentOwnerId,
      appId: appIdOverride
    } = body;

    if (!aid || !sid || !skey || !recipientId) {
      return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });
    }

    // Verify session
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } }
    });

    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const appId = appIdOverride || session.appId;
    const isInternal = isInternalApp(appId);

    if (isInternal) {
      const finalParentOwnerId = typeof parentOwnerId === 'string' && parentOwnerId.trim() ? parentOwnerId.trim() : aid;
      if (finalParentOwnerId !== aid) {
        return NextResponse.json(
          { error: 'forbidden', error_description: 'parentOwnerId must match the authenticated primary account.' },
          { status: 403 }
        );
      }

      const membership = await prisma.accessMember.upsert({
        where: {
          parentOwnerId_memberAccountId: {
            parentOwnerId: finalParentOwnerId,
            memberAccountId: recipientId,
          }
        },
        update: { status: typeof status === 'string' && status.trim() ? status.trim() : 'invited' },
        create: {
          parentOwnerId: finalParentOwnerId,
          memberAccountId: recipientId,
          status: typeof status === 'string' && status.trim() ? status.trim() : 'invited',
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Member access saved',
        member: mapMembership(membership),
      });
    } else {
      await prisma.authTeamExternal.upsert({
        where: { appId_accountId_recipientId: { appId, accountId: aid, recipientId } },
        update: { isPermanent: !!isPermanent },
        create: { appId, accountId: aid, recipientId, isPermanent: !!isPermanent }
      });
    }

    return NextResponse.json({ success: true, message: 'User added to team' });

  } catch (error) {
    await logError('auth', error, 'post_auth_access');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}

/**
 * PATCH /bridge/api.v1/auth/access
 * Updates roles, user permissions, or asset permissions.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    // Verify session
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } }
    });

    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
        return NextResponse.json(
          { error: 'forbidden', error_description: 'parentOwnerId must match the authenticated primary account.' },
          { status: 403 }
        );
      }

      if (add || remove) {
        return NextResponse.json(
          {
            error: 'invalid_request',
            error_description: 'Internal apps now use role and status updates instead of add/remove permission arrays.'
          },
          { status: 400 }
        );
      }

      const nextRole =
        typeof role === 'string' && role.trim()
          ? role.trim()
          : typeof update === 'string' && update.trim()
            ? update.trim()
            : null;
      const nextStatus = typeof status === 'string' && status.trim() ? status.trim() : null;

      if (!nextRole && !nextStatus) {
        return NextResponse.json(
          { error: 'missing_parameters', error_description: 'A role/update or status value is required.' },
          { status: 400 }
        );
      }

      const hasMembership = await hasJoinedOrInvitedMembership(resolvedParentOwnerId, recipientId);
      if (!hasMembership) {
        return NextResponse.json(
          {
            error: 'missing_membership',
            error_description: 'Create an access_members record before granting internal app access.'
          },
          { status: 409 }
        );
      }

      const uniqueAccess = {
        accountId_appId_resourceId_parentOwnerId: {
          accountId: recipientId,
          appId,
          resourceId: resolvedResourceId,
          parentOwnerId: resolvedParentOwnerId,
        }
      };

      const existingAccess = await prisma.accountAccess.findUnique({
        where: uniqueAccess
      });

      if (!existingAccess && !nextRole) {
        return NextResponse.json(
          { error: 'missing_role', error_description: 'A role is required when creating a new access record.' },
          { status: 400 }
        );
      }

      const savedAccess = existingAccess
        ? await prisma.accountAccess.update({
            where: uniqueAccess,
            data: {
              ...(nextRole ? { role: nextRole } : {}),
              ...(nextStatus ? { status: nextStatus } : {}),
            }
          })
        : await prisma.accountAccess.create({
            data: {
              accountId: recipientId,
              appId,
              resourceId: resolvedResourceId,
              parentOwnerId: resolvedParentOwnerId,
              role: nextRole!,
              status: nextStatus || 'active',
            }
          });

      return NextResponse.json({
        success: true,
        access: mapAccountAccess(savedAccess),
      });
    }

    // 1. Update Role
    if (update && typeof update === 'string') {
      await prisma.authRoleExternal.upsert({
        where: { accountId_appId: { accountId: recipientId, appId } },
        update: { role: update },
        create: { accountId: recipientId, appId, role: update }
      });
    }

    // 2. Update Resource/Recipient Permissions
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
            data: { appId, recipientId, ownerId: finalOwnerId, assetId: finalResourceId, permission: perm }
          });
        }
      }
      if (remove && Array.isArray(remove)) {
        await prisma.authPermissionRecipient.deleteMany({
          where: { appId, recipientId, ownerId: finalOwnerId, assetId: finalResourceId, permission: { in: remove } }
        });
      }
    } else if (add || remove) {
      // 3. Update Simple Permissions (Legacy/Simple)
      const existing = await prisma.authPermissionsExternal.findUnique({
        where: { accountId_appId: { accountId: recipientId, appId } }
      });
      let perms = (existing?.permissions as string[]) || [];
      if (add) perms = Array.from(new Set([...perms, ...(Array.isArray(add) ? add : [add])]));
      if (remove) perms = perms.filter(p => !(Array.isArray(remove) ? remove : [remove]).includes(p));

      await prisma.authPermissionsExternal.upsert({
        where: { accountId_appId: { accountId: recipientId, appId } },
        update: { permissions: perms },
        create: { accountId: recipientId, appId, permissions: perms }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    await logError('auth', error, 'patch_auth_access');
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }
}
