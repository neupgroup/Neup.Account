import prisma from '@/core/helpers/prisma';
import { PERMISSION_SET } from '@/services/permissions';

const APP_ID = 'neup.account';
const ROLE_NAME = 'individual.default';
const ROLE_DESCRIPTION = 'Default Permission for Individual Account Type.';
const DEFAULT_SCOPE = 'default';

function getNonAdminPermissions(): string[] {
  const allPermissions = Object.values(PERMISSION_SET).flat();
  const filtered = allPermissions.filter((permission) => {
    const value = permission.trim().toLowerCase();
    return !value.startsWith('root.') && !value.startsWith('admin.');
  });

  return Array.from(new Set(filtered));
}

export async function seedIndividualDefaultRoleCapability() {
  const nonAdminPermissions = getNonAdminPermissions();

  const app = await prisma.application.findUnique({
    where: { id: APP_ID },
    select: { id: true },
  });

  if (!app) {
    throw new Error(`Application ${APP_ID} not found. Create application first.`);
  }

  let role = await prisma.authzRole.findFirst({
    where: {
      name: ROLE_NAME,
      appId: APP_ID,
      scope: DEFAULT_SCOPE,
    },
    select: { id: true },
  });

  if (!role) {
    role = await prisma.authzRole.create({
      data: {
        name: ROLE_NAME,
        description: ROLE_DESCRIPTION,
        appId: APP_ID,
        scope: DEFAULT_SCOPE,
      },
      select: { id: true },
    });
  } else {
    await prisma.authzRole.update({
      where: { id: role.id },
      data: {
        description: ROLE_DESCRIPTION,
        appId: APP_ID,
        scope: DEFAULT_SCOPE,
      },
    });
  }

  const capabilityIds: string[] = [];

  for (const permissionName of nonAdminPermissions) {
    let capability = await prisma.authzCapability.findFirst({
      where: {
        name: permissionName,
        appId: APP_ID,
        scope: DEFAULT_SCOPE,
      },
      select: { id: true },
    });

    if (!capability) {
      capability = await prisma.authzCapability.create({
        data: {
          name: permissionName,
          appId: APP_ID,
          scope: DEFAULT_SCOPE,
        },
        select: { id: true },
      });
    }

    capabilityIds.push(capability.id);
  }

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
          scope: DEFAULT_SCOPE,
          appId: APP_ID,
          roleName: ROLE_NAME,
          denormalizedCapability: nonAdminPermissions,
        },
      });
    } else {
      await prisma.authzRoleCapability.update({
        where: { id: existingMap.id },
        data: {
          scope: DEFAULT_SCOPE,
          appId: APP_ID,
          roleName: ROLE_NAME,
          denormalizedCapability: nonAdminPermissions,
        },
      });
    }
  }

  return {
    appId: APP_ID,
    roleName: ROLE_NAME,
    roleId: role.id,
    capabilityCount: nonAdminPermissions.length,
  };
}
