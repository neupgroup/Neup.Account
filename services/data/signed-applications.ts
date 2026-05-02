'use server';

import prisma from '@/core/helpers/prisma';
import { getPersonalAccountId } from '@/core/auth/actions';
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
    const connections = await prisma.applicationConnection.findMany({
      where: { accountId },
      include: { application: true },
      orderBy: { connectedAt: 'desc' },
    });

    const resolvedApplications = connections
      .map((conn) => ({
        id: conn.application.id,
        name: conn.application.name,
        icon: conn.application.icon || undefined,
        description: conn.application.description || '',
        website: conn.application.website || undefined,
        developer: conn.application.developer || undefined,
        signedAt: conn.connectedAt,
      }))
      .sort((a, b) => b.signedAt.getTime() - a.signedAt.getTime());

    return {
      internal: resolvedApplications.filter((app) => isInternalApp(app.id)),
      external: resolvedApplications.filter((app) => !isInternalApp(app.id)),
    };
  } catch (error) {
    await logError('database', error, 'getSignedApplications');
    return { internal: [], external: [] };
  }
}
