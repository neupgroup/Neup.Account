import React from 'react';
import { StartPageComponent } from './start-page-component';
import { getAuthStartPageData } from '@/services/auth/start';

type StartPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StartPage({ searchParams }: StartPageProps) {
  const resolvedSearchParams = await searchParams;
  const pageData = await getAuthStartPageData(resolvedSearchParams);
  
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <StartPageComponent
        accounts={pageData.accounts}
        hasActiveSession={pageData.hasActiveSession}
        appName={pageData.appName}
      />
    </React.Suspense>
  )
}
