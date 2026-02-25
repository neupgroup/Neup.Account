'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { logError } from '@/lib/logger';
import { getSessionCookies } from '@/lib/cookies';

export type Session = {
  accountId: string;
  sessionId: string;
  sessionKey: string;
};

const SESSION_DURATION_DAYS = 30;

export async function hasActiveSessionCookies(): Promise<boolean> {
  const cookieStore = await cookies();
  return (
    cookieStore.has('auth_account_id') &&
    cookieStore.has('auth_session_id') &&
    cookieStore.has('auth_session_key')
  );
}

export async function getActiveSession(): Promise<Session | null> {
  const { accountId, sessionId, sessionKey } = await getSessionCookies();

  if (!accountId || !sessionId || !sessionKey) {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    const dbExpiresOn = session.expiresOn;

    const isInvalid =
      !dbExpiresOn ||
      dbExpiresOn < new Date() ||
      session.isExpired ||
      session.accountId !== accountId ||
      session.authSessionKey !== sessionKey;

    if (isInvalid) {
      return null;
    }

    return {
      accountId: session.accountId,
      sessionId: sessionId,
      sessionKey: session.authSessionKey || '',
    };
  } catch (error) {
    await logError('database', error, 'getActiveSession');
    return null;
  }
}

export async function validateCurrentSession() {
  const session = await getActiveSession();
  
  if (!session) {
    redirect('/auth/signout?error=session_expired&error_description=Your session has expired. Please sign in again.');
  }
  
  return session;
}

export async function getActiveAccountId(): Promise<string | null> {
    const { managingAccountId, accountId } = await getSessionCookies();
    return managingAccountId || accountId || null;
}

export async function getPersonalAccountId(): Promise<string | null> {
    const { accountId } = await getSessionCookies();
    return accountId || null;
}

export async function refreshSessionData(): Promise<{ success: boolean; error?: string }> {
    // This function is no longer responsible for setting profile cookies.
    // That logic is now handled on the client-side by SessionProvider.
    // We keep this function in case we need to refresh server-side session
    // data in the future, but for now it does nothing.
    return { success: true };
}
