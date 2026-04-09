import prisma from '@/core/helpers/prisma';
import { getActiveSession } from '@/core/helpers/auth-actions';
import { getValidatedStoredAccounts } from '@/core/helpers/session';

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

export async function getAuthStartPageData(searchParams: Record<string, string | string[] | undefined>) {
  const accounts = await getValidatedStoredAccounts();
  const activeSession = await getActiveSession();
  const appId = getFirstValue(searchParams.appId) || getFirstValue(searchParams.appid);

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
