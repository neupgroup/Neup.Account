import React from 'react';
import { getValidatedStoredAccounts } from '@/lib/session';
import { getSessionCookies } from '@/lib/cookies';
import { StartPageComponent } from './start-page-component';

export default async function StartPage() {
  const accounts = await getValidatedStoredAccounts();
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  
  const hasActiveSession = !!(accountId && sessionId && sessionKey);
  
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <StartPageComponent accounts={accounts} hasActiveSession={hasActiveSession} />
    </React.Suspense>
  )
}
