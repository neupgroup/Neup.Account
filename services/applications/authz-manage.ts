'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/core/helpers/prisma';
import { getActiveAccountId } from '@/core/auth/verify';
import { logError } from '@/core/helpers/logger';
import { dispatchAuthzWebhook } from './authz-webhook';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppCapability = {
  id: string;
  name: string;
  description: string | null;
  scope: string | null;
};

export type AppRole = {
  id: string;
  name: string;
  description: string | null;
  scope: string | null;
  capabilities: AppCapability[];
};

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

async function assertOwner(appId: string): Promise<{ accountId: string } | { error: string }> {
  const accountId = await getActiveAccountId();
  if (!accountId) return { error: 'Not signed in.' };

  const grant = await prisma.authzAccountAccessGrant.findFirst({
    where: { targetAccountId: accountId, appId, roleId: 'application.owner' },
    select: { id: true },
  });

  if (!grant) return { error: 'Permission denied.' };
  return { accountId };
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export async function getAppCapabilities(appId: string): Promise<AppCapability[]> {
  try {
    const records = await prisma.authzCapability.findMany({
      where: { appId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, scope: true },
    });
    return records;
  } catch (error) {
    await logError('database', error, `getAppCapabilities:${appId}`);
    return [];
  }
}

export async function createAppCapability(input: {
  appId: string;
  name: string;
  description?: string;
  scope?: string;
}): Promise<{ success: boolean; capability?: AppCapability; error?: string }> {
  const auth = await assertOwner(input.appId);
  if ('error' in auth) return { success: false, error: auth.error };

  const name = input.name.trim();
  if (!name) return { success: false, error: 'Capability name is required.' };

  try {
    const record = await prisma.authzCapability.create({
      data: {
        name,
        description: input.description?.trim() || null,
        scope: input.scope?.trim() || null,
        appId: input.appId,
      },
      select: { id: true, name: true, description: true, scope: true },
    });

    revalidatePath(`/data/applications/${input.appId}`);
    return { success: true, capability: record };
  } catch (error) {
    await logError('database', error, `createAppCapability:${input.appId}`);
    return { success: false, error: 'Failed to create capability.' };
  }
}

export async function deleteAppCapability(input: {
  appId: string;
  capabilityId: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await assertOwner(input.appId);
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    await prisma.authzCapability.delete({ where: { id: input.capabilityId } });
    revalidatePath(`/data/applications/${input.appId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `deleteAppCapability:${input.appId}`);
    return { success: false, error: 'Failed to delete capability.' };
  }
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function getAppRoles(appId: string): Promise<AppRole[]> {
  try {
    const roles = await prisma.authzRole.findMany({
      where: { appId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        roleMaps: {
          select: {
            capability: {
              select: { id: true, name: true, description: true, scope: true },
            },
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      scope: role.scope,
      capabilities: role.roleMaps.map((m) => m.capability),
    }));
  } catch (error) {
    await logError('database', error, `getAppRoles:${appId}`);
    return [];
  }
}

export async function createAppRole(input: {
  appId: string;
  name: string;
  description?: string;
  scope?: string;
  capabilityIds: string[];
}): Promise<{ success: boolean; role?: AppRole; error?: string }> {
  const auth = await assertOwner(input.appId);
  if ('error' in auth) return { success: false, error: auth.error };

  const name = input.name.trim();
  if (!name) return { success: false, error: 'Role name is required.' };
  if (!/^[a-z0-9._]+$/.test(name)) {
    return { success: false, error: 'Role name may only contain lowercase letters, numbers, dots (.) and underscores (_).' };
  }

  // Enforce uniqueness: one role per name per app
  const existing = await prisma.authzRole.findFirst({
    where: { name, appId: input.appId },
    select: { id: true },
  });
  if (existing) {
    return { success: false, error: `A role named "${name}" already exists for this application.` };
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.authzRole.create({
        data: {
          name,
          description: input.description?.trim() || null,
          scope: input.scope?.trim() || null,
          appId: input.appId,
        },
        select: { id: true, name: true, description: true, scope: true },
      });

      if (input.capabilityIds.length > 0) {
        const caps = await tx.authzCapability.findMany({
          where: { id: { in: input.capabilityIds }, appId: input.appId },
          select: { id: true, name: true },
        });

        await tx.authzRoleCapability.createMany({
          data: caps.map((cap) => ({
            roleId: created.id,
            capabilityId: cap.id,
            appId: input.appId,
            roleName: name,
            denormalizedCapability: [cap.name],
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    // Dispatch webhook
    const fullRole = await getAppRoles(input.appId).then((roles) =>
      roles.find((r) => r.id === role.id) ?? { ...role, capabilities: [] }
    );

    revalidatePath(`/data/applications/${input.appId}`);
    return { success: true, role: fullRole };
  } catch (error) {
    await logError('database', error, `createAppRole:${input.appId}`);
    return { success: false, error: 'Failed to create role.' };
  }
}

export async function updateAppRoleCapabilities(input: {
  appId: string;
  roleId: string;
  capabilityIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const auth = await assertOwner(input.appId);
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    await prisma.$transaction(async (tx) => {
      const role = await tx.authzRole.findFirst({
        where: { id: input.roleId, appId: input.appId },
        select: { id: true, name: true },
      });
      if (!role) throw new Error('Role not found.');

      await tx.authzRoleCapability.deleteMany({ where: { roleId: input.roleId } });

      if (input.capabilityIds.length > 0) {
        const caps = await tx.authzCapability.findMany({
          where: { id: { in: input.capabilityIds }, appId: input.appId },
          select: { id: true, name: true },
        });

        await tx.authzRoleCapability.createMany({
          data: caps.map((cap) => ({
            roleId: input.roleId,
            capabilityId: cap.id,
            appId: input.appId,
            roleName: role.name,
            denormalizedCapability: [cap.name],
          })),
          skipDuplicates: true,
        });
      }
    });

    revalidatePath(`/data/applications/${input.appId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `updateAppRoleCapabilities:${input.appId}`);
    return { success: false, error: 'Failed to update role capabilities.' };
  }
}

export async function deleteAppRole(input: {
  appId: string;
  roleId: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await assertOwner(input.appId);
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    await prisma.authzRole.delete({ where: { id: input.roleId } });
    revalidatePath(`/data/applications/${input.appId}`);
    return { success: true };
  } catch (error) {
    await logError('database', error, `deleteAppRole:${input.appId}`);
    return { success: false, error: 'Failed to delete role.' };
  }
}

// ---------------------------------------------------------------------------
// Push all roles + capabilities to the registered webhook
// ---------------------------------------------------------------------------

export async function pushAuthzToWebhook(appId: string): Promise<{
  success: boolean;
  pushed: number;
  error?: string;
}> {
  const auth = await assertOwner(appId);
  if ('error' in auth) return { success: false, pushed: 0, error: auth.error };

  try {
    const roleMaps = await prisma.authzRoleCapability.findMany({
      where: { appId },
      select: {
        id: true,
        roleId: true,
        capabilityId: true,
        scope: true,
        denormalizedCapability: true,
        roleName: true,
      },
    });

    if (roleMaps.length === 0) {
      return { success: true, pushed: 0 };
    }

    // Push each role-capability mapping as an insert
    for (const map of roleMaps) {
      await dispatchAuthzWebhook(appId, {
        table: 'authz_role_capability',
        operation: 'insert',
        data: {
          roleId: map.roleId,
          capabilityId: map.capabilityId,
          scope: map.scope,
          denormalizedCapability: map.denormalizedCapability,
          roleName: map.roleName,
        },
      });
    }

    return { success: true, pushed: roleMaps.length };
  } catch (error) {
    await logError('webhook', error, `pushAuthzToWebhook:${appId}`);
    return { success: false, pushed: 0, error: 'Failed to push data.' };
  }
}
