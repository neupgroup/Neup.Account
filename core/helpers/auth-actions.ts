'use server';

import { redirect } from 'next/navigation';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { authCookies, getSessionCookies } from '@/core/helpers/cookies';

export type Session = {
  aid?: string;
  sid?: string;
  skey?: string;
  accountId: string;
  sessionId: string;
  sessionKey: string;
  jwt?: string;
};

const SESSION_DURATION_DAYS = 30;

export async function hasActiveSessionCookies(): Promise<boolean> {
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  return Boolean(accountId && sessionId && sessionKey);
}

export async function getActiveSession(): Promise<Session | null> {
  const { accountId, sessionId, sessionKey } = await getSessionCookies();

  if (!accountId || !sessionId || !sessionKey) {
    return null;
  }

  try {
    const session = await prisma.authSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return null;
    }

    const dbValidTill = session.validTill;
    const dbKey = session.key;

    const isInvalid =
      !dbValidTill ||
      dbValidTill < new Date() ||
      session.accountId !== accountId ||
      !dbKey ||
      dbKey !== sessionKey;

    if (isInvalid) {
      return null;
    }

    return {
      aid: session.accountId,
      sid: sessionId,
      skey: dbKey,
      accountId: session.accountId,
      sessionId: sessionId,
      sessionKey: dbKey,
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
