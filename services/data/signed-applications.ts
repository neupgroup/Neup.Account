'use server';

import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/helpers/auth-actions';
import { logError } from '@/core/helpers/logger';

/**
 * Type SignedApplication.
 */
type SignedApplication = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  description: string;
  website?: string;
  developer?: string;
  signedAt: Date;
};


/**
 * Type SignedApplicationsResult.
 */
type SignedApplicationsResult = {
  internal: SignedApplication[];
  external: SignedApplication[];
};


/**
 * Function isInternalApp.
 */
function isInternalApp(appId: string): boolean {
  return appId.startsWith('neup.');
}


/**
 * Function getSignedApplications.
 */
export async function getSignedApplications(): Promise<SignedApplicationsResult> {
  const accountId = await getPersonalAccountId();
  if (!accountId) {
    return { internal: [], external: [] };
  }

  try {
    const [authConnections, externalSessions] = await Promise.all([
      prisma.appAuthentication.findMany({
        where: { accountId },
        include: {
          application: true,
        },
      }),
      prisma.authSessionExternal.findMany({
        where: { accountId },
        distinct: ['appId'],
        include: {
          application: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    const byAppId = new Map<string, SignedApplication>();

    for (const row of authConnections) {
      byAppId.set(row.appId, {
        id: row.appId,
        name: row.application.name,
        icon: row.application.icon || undefined,
        description: row.application.description || '',
        website: row.application.website || undefined,
        developer: row.application.developer || undefined,
        signedAt: row.createdAt,
      });
    }

    for (const row of externalSessions) {
      const existing = byAppId.get(row.appId);

      if (!existing) {
        byAppId.set(row.appId, {
          id: row.appId,
          name: row.application.name,
          icon: row.application.icon || undefined,
          description: row.application.description || '',
          website: row.application.website || undefined,
          developer: row.application.developer || undefined,
          signedAt: row.createdAt,
        });
        continue;
      }

      if (row.createdAt < existing.signedAt) {
        byAppId.set(row.appId, {
          ...existing,
          signedAt: row.createdAt,
        });
      }
    }

    const applications = Array.from(byAppId.values()).sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    return {
      internal: applications.filter((app) => isInternalApp(app.id)),
      external: applications.filter((app) => !isInternalApp(app.id)),
    };
  } catch (error) {
    await logError('database', error, 'getSignedApplications');
    return { internal: [], external: [] };
  }
}
