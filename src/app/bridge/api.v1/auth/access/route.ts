
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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
    const isInternal = appId.startsWith('neup.');

    // 2. Fetch Roles
    let roleInfo = null;
    if (isInternal) {
      roleInfo = await prisma.authRole.findUnique({
        where: { appId_accountId: { appId, accountId: aid } }
      });
    } else {
      roleInfo = await prisma.authRoleExternal.findUnique({
        where: { accountId_appId: { accountId: aid, appId } }
      });
    }

    // 3. Fetch Team Membership
    let teamInfo = null;
    if (isInternal) {
      teamInfo = await prisma.authTeam.findMany({
        where: { recipientId: aid, appId }
      });
    } else {
      teamInfo = await prisma.authTeamExternal.findMany({
        where: { recipientId: aid, appId }
      });
    }

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
    const { aid, sid, skey, recipientId, isPermanent, appId: appIdOverride } = body;

    if (!aid || !sid || !skey || !recipientId) {
      return NextResponse.json({ error: 'missing_parameters' }, { status: 400 });
    }

    // Verify session
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } }
    });

    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const appId = appIdOverride || session.appId;
    const isInternal = appId.startsWith('neup.');

    if (isInternal) {
      await prisma.authTeam.upsert({
        where: { appId_accountId_recipientId: { appId, accountId: aid, recipientId } },
        update: { isPermanent: !!isPermanent },
        create: { appId, accountId: aid, recipientId, isPermanent: !!isPermanent }
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
    const { aid, sid, skey, update, add, remove, assetId, ownerId, recipientId: targetId } = body;

    // Verify session
    const session = await prisma.authSessionExternal.findFirst({
      where: { id: sid, accountId: aid, sessionKey: skey, expiresOn: { gt: new Date() } }
    });

    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const appId = session.appId;
    const isInternal = appId.startsWith('neup.');
    const recipientId = targetId || aid;

    // 1. Update Role
    if (update && typeof update === 'string') {
      if (isInternal) {
        await prisma.authRole.upsert({
          where: { appId_accountId: { appId, accountId: recipientId } },
          update: { role: update },
          create: { appId, accountId: recipientId, role: update }
        });
      } else {
        await prisma.authRoleExternal.upsert({
          where: { accountId_appId: { accountId: recipientId, appId } },
          update: { role: update },
          create: { accountId: recipientId, appId, role: update }
        });
      }
    }

    // 2. Update Asset/Recipient Permissions
    if (assetId || ownerId) {
      const finalOwnerId = ownerId || aid;
      if (add && Array.isArray(add)) {
        for (const perm of add) {
          await prisma.authPermissionRecipient.create({
            data: { appId, recipientId, ownerId: finalOwnerId, assetId, permission: perm }
          });
        }
      }
      if (remove && Array.isArray(remove)) {
        await prisma.authPermissionRecipient.deleteMany({
          where: { appId, recipientId, ownerId: finalOwnerId, assetId, permission: { in: remove } }
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
