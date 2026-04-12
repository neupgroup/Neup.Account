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

/**
 * Type UserApplicationAccess.
 */
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


/**
 * Function getUserApplicationAccess.
 */
export async function getUserApplicationAccess(appId: string): Promise<UserApplicationAccess | null> {
  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return null;
  }

  try {
    const [application, appAuthentication, externalSession] = await Promise.all([
      prisma.application.findUnique({
        where: { id: appId },
      }),
      prisma.appAuthentication.findUnique({
        where: {
          appId_accountId: {
            appId,
            accountId,
          },
        },
      }),
      prisma.appSession.findFirst({
        where: {
          appId,
          accountId,
        },
        orderBy: {
          createdOn: 'asc',
        },
      }),
    ]);

    if (!application || (!appAuthentication && !externalSession)) {
      return null;
    }

    const connectionType: UserApplicationAccess['connectionType'] = appAuthentication && externalSession
      ? 'both'
      : appAuthentication
        ? 'internal'
        : 'external';

    const permissions = Array.isArray(appAuthentication?.permissions)
      ? (appAuthentication?.permissions as string[])
      : [];

    const connectedOnCandidates = [appAuthentication?.createdAt, externalSession?.createdOn].filter(Boolean) as Date[];
    const connectedOn = connectedOnCandidates.length > 0
      ? connectedOnCandidates.reduce((earliest, current) => (current < earliest ? current : earliest))
      : new Date();

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


/**
 * Function addUserApplicationAccess.
 */
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

    await prisma.appAuthentication.upsert({
      where: {
        appId_accountId: {
          appId,
          accountId,
        },
      },
      create: {
        appId,
        accountId,
        permissions,
      },
      update: {
        permissions,
      },
    });

    revalidatePath('/data/applications');
    revalidatePath(`/data/applications/${appId}`);
    revalidatePath(`/data/applications/${appId}/edit`);

    return { success: true, appId };
  } catch (error) {
    await logError('database', error, `addUserApplicationAccess:${appId}`);
    return { success: false, error: 'Failed to add application access.' };
  }
}


/**
 * Function updateUserApplicationPermissions.
 */
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
    const existing = await prisma.appAuthentication.findUnique({
      where: {
        appId_accountId: {
          appId,
          accountId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: 'Internal application access not found for edit.' };
    }

    await prisma.appAuthentication.update({
      where: {
        appId_accountId: {
          appId,
          accountId,
        },
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
