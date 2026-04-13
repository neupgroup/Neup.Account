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
    const appSessions = await prisma.session.findMany({
      where: {
        accountId,
        application: { not: null },
      },
      distinct: ['application'],
      orderBy: {
        lastLoggedIn: 'asc',
      },
    });

    const appIds = Array.from(
      new Set(appSessions.map((row) => row.application).filter((id): id is string => Boolean(id)))
    );
    const appRows = await prisma.application.findMany({
      where: { id: { in: appIds } },
    });

    const appById = new Map(appRows.map((app) => [app.id, app]));
    const byAppId = new Map<string, SignedApplication>();

    for (const row of appSessions) {
      if (!row.application) continue;
      const application = appById.get(row.application);
      if (!application) continue;

      const existing = byAppId.get(row.application);

      if (!existing) {
        byAppId.set(row.application, {
          id: row.application,
          name: application.name,
          icon: application.icon || undefined,
          description: application.description || '',
          website: application.website || undefined,
          developer: application.developer || undefined,
          signedAt: row.lastLoggedIn,
        });
        continue;
      }

      if (row.lastLoggedIn < existing.signedAt) {
        byAppId.set(row.application, {
          ...existing,
          signedAt: row.lastLoggedIn,
        });
      }
    }

    const resolvedApplications = Array.from(byAppId.values()).sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    return {
      internal: resolvedApplications.filter((app) => isInternalApp(app.id)),
      external: resolvedApplications.filter((app) => !isInternalApp(app.id)),
    };
  } catch (error) {
    await logError('database', error, 'getSignedApplications');
    return { internal: [], external: [] };
  }
}
