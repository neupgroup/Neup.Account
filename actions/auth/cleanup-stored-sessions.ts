'use server';

import { cleanupExpiredStoredSessions } from '@/lib/session';

export async function cleanupStoredSessionsAction() {
  await cleanupExpiredStoredSessions();
  return { success: true };
}
