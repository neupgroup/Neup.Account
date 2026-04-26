import prisma from '@/core/helpers/prisma';
import { getActiveSession } from '@/core/helpers/auth-actions';
import { getValidatedStoredAccounts } from '@/core/helpers/session';

/**
 * Function getFirstValue.
 */
function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}


/**
 * Function getAuthStartPageData.
 */
export async function getAuthStartPageData(searchParams: Record<string, string | string[] | undefined>) {
  let accounts = await getValidatedStoredAccounts();
  const activeSession = await getActiveSession();
  const appId = getFirstValue(searchParams.appId) || getFirstValue(searchParams.appid);

  try {
    const uniqueIds = Array.from(new Set(accounts.map((account) => account.aid).filter(Boolean)));
    if (uniqueIds.length > 0) {
      const existing = await prisma.account.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((entry) => entry.id));
      accounts = accounts.filter((account) => existingIds.has(account.aid));
    }
  } catch {
    // If the database is unavailable, fall back to showing the stored accounts.
  }

  const application = appId
    ? await prisma.application.findUnique({
        where: { id: appId },
        select: { name: true },
      })
    : null;

  return {
    accounts,
    hasActiveSession: Boolean(activeSession),
    appName: application?.name,
  };
}
