import prisma from '@/core/helpers/prisma';
import { PERMISSION_SET } from '@/services/permissions';

const APP_ID = 'neup.account';
const ROLE_NAME = 'application.owner';
const ROLE_DESCRIPTION = 'Role for application creators and owners.';
const ROLE_SCOPE = 'creator';

export async function seedApplicationOwnerRole() {
  const app = await prisma.application.findUnique({
    where: { id: APP_ID },
    select: { id: true },
  });

  if (!app) {
    throw new Error(`Application ${APP_ID} not found. Create application first.`);
  }

  // Get the permissions for application.owner role
  const permissions = PERMISSION_SET['application.owner'] || [];
  if (permissions.length === 0) {
    throw new Error(`No permissions found for ${ROLE_NAME} in PERMISSION_SET`);
  }

  // Create or update the role
  let role = await prisma.authzRole.findFirst({
    where: {
      name: ROLE_NAME,
      appId: APP_ID,
      scope: ROLE_SCOPE,
    },
    select: { id: true },
  });

  if (!role) {
    role = await prisma.authzRole.create({
      data: {
        name: ROLE_NAME,
        description: ROLE_DESCRIPTION,
        appId: APP_ID,
        scope: ROLE_SCOPE,
      },
      select: { id: true },
    });
  } else {
    await prisma.authzRole.update({
      where: { id: role.id },
      data: {
        description: ROLE_DESCRIPTION,
        appId: APP_ID,
        scope: ROLE_SCOPE,
      },
    });
  }

  const capabilityIds: string[] = [];

  // Create capabilities for each permission
  for (const permissionName of permissions) {
    let capability = await prisma.authzCapability.findFirst({
      where: {
        name: permissionName,
        appId: APP_ID,
        scope: ROLE_SCOPE,
      },
      select: { id: true },
    });

    if (!capability) {
      capability = await prisma.authzCapability.create({
        data: {
          name: permissionName,
          appId: APP_ID,
          scope: ROLE_SCOPE,
        },
        select: { id: true },
      });
    }

    capabilityIds.push(capability.id);
  }

  // Create role-capability mappings
  for (const capabilityId of capabilityIds) {
    const existingMap = await prisma.authzRoleCapability.findFirst({
      where: {
        roleId: role.id,
        capabilityId,
      },
      select: { id: true },
    });

    if (!existingMap) {
      await prisma.authzRoleCapability.create({
        data: {
          roleId: role.id,
          capabilityId,
          scope: ROLE_SCOPE,
          appId: APP_ID,
          roleName: ROLE_NAME,
          denormalizedCapability: permissions,
        },
      });
    } else {
      await prisma.authzRoleCapability.update({
        where: { id: existingMap.id },
        data: {
          scope: ROLE_SCOPE,
          appId: APP_ID,
          roleName: ROLE_NAME,
          denormalizedCapability: permissions,
        },
      });
    }
  }

  return {
    appId: APP_ID,
    roleName: ROLE_NAME,
    roleId: role.id,
    capabilityCount: permissions.length,
  };
}
