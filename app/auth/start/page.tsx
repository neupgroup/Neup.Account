import React from 'react';
import { getValidatedStoredAccounts } from '@/core/helpers/session';
import { StartPageComponent } from './start-page-component';
import prisma from '@/core/helpers/prisma';
import { getActiveSession } from '@/core/helpers/auth-actions';

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
  const activeSession = await getActiveSession();
  const appId = getFirstValue(resolvedSearchParams.appId) || getFirstValue(resolvedSearchParams.appid);
  
  const hasActiveSession = !!activeSession;
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
