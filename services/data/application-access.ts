'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logError } from '@/core/helpers/logger';

const manageApplicationSchema = z.object({
  appId: z.string().min(1, 'Application ID is required.'),
  permissions: z.array(z.string().min(1)).default([]),
});

export type UserApplicationAccess = {
  id: string;
  name: string;
  description: string;
  website?: string;
  developer?: string;
  connectionType: 'internal' | 'external' | 'both';
  permissions: string[];
  connectedOn: Date;
};

export async function getUserApplicationAccess(appId: string): Promise<UserApplicationAccess | null> {
  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return null;
  }

  try {
    const [application, sessions] = await Promise.all([
      prisma.application.findUnique({ where: { id: appId } }),
      prisma.session.findMany({
        where: {
          accountId,
          application: appId,
        },
        orderBy: {
          lastLoggedIn: 'asc',
        },
      }),
    ]);

    if (!application || sessions.length === 0) {
      return null;
    }

    const hasInternal = sessions.some((row) => row.applicationType === 'internal');
    const hasExternal = sessions.some((row) => row.applicationType === 'external');

    const connectionType: UserApplicationAccess['connectionType'] = hasInternal && hasExternal
      ? 'both'
      : hasInternal
        ? 'internal'
        : 'external';

    const permissions = Array.from(
      new Set(
        sessions.flatMap((row) => (Array.isArray(row.permissions) ? (row.permissions as string[]) : []))
      )
    );

    const connectedOn = sessions[0]?.lastLoggedIn || new Date();

    return {
      id: application.id,
      name: application.name,
      description: application.description || '',
      website: application.website || undefined,
      developer: application.developer || undefined,
      connectionType,
      permissions,
      connectedOn,
    };
  } catch (error) {
    await logError('database', error, `getUserApplicationAccess:${appId}`);
    return null;
  }
}

export async function addUserApplicationAccess(input: { appId: string; permissions: string[] }) {
  const parsed = manageApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid application input.' };
  }

  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  const { appId, permissions } = parsed.data;

  try {
    const application = await prisma.application.findUnique({
      where: { id: appId },
      select: { id: true },
    });

    if (!application) {
      return { success: false, error: 'Application not found.' };
    }

    const existing = await prisma.session.findFirst({
      where: {
        accountId,
        application: appId,
        applicationType: 'internal',
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          permissions,
          lastLoggedIn: new Date(),
        },
      });
    } else {
      await prisma.session.create({
        data: {
          accountId,
          application: appId,
          applicationType: 'internal',
          ipAddress: 'Unknown IP',
          userAgent: 'Internal Application Access',
          lastLoggedIn: new Date(),
          loginType: 'internal_app_access',
          isExpired: false,
          permissions,
        },
      });
    }

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${appId}`);
    revalidatePath(`/data/applications/${appId}/edit`);

    return { success: true, appId };
  } catch (error) {
    await logError('database', error, `addUserApplicationAccess:${appId}`);
    return { success: false, error: 'Failed to add application access.' };
  }
}

export async function updateUserApplicationPermissions(input: { appId: string; permissions: string[] }) {
  const parsed = manageApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid application input.' };
  }

  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return { success: false, error: 'Not signed in.' };
  }

  const { appId, permissions } = parsed.data;

  try {
    const existing = await prisma.session.findFirst({
      where: {
        accountId,
        application: appId,
      },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: 'Application access not found for edit.' };
    }

    await prisma.session.updateMany({
      where: {
        accountId,
        application: appId,
      },
      data: {
        permissions,
      },
    });

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${appId}`);
    revalidatePath(`/data/applications/${appId}/edit`);

    return { success: true, appId };
  } catch (error) {
    await logError('database', error, `updateUserApplicationPermissions:${appId}`);
    return { success: false, error: 'Failed to update permissions.' };
  }
}
