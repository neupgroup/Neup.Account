import React from 'react';
import { getValidatedStoredAccounts } from '@/lib/session';
import { getSessionCookies } from '@/lib/cookies';
import { StartPageComponent } from './start-page-component';
import prisma from '@/lib/prisma';

type StartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? undefined;
  }

  return value;
}

export default async function StartPage({ searchParams }: StartPageProps) {
  const resolvedSearchParams = await searchParams;
  const accounts = await getValidatedStoredAccounts();
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  const appId = getFirstValue(resolvedSearchParams.appId) || getFirstValue(resolvedSearchParams.appid);
  
  const hasActiveSession = !!(accountId && sessionId && sessionKey);
  const application = appId
    ? await prisma.application.findUnique({
        where: { id: appId },
        select: { name: true },
      })
    : null;
  
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <StartPageComponent
        accounts={accounts}
        hasActiveSession={hasActiveSession}
        appName={application?.name}
      />
    </React.Suspense>
  )
}
