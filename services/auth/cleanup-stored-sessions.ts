'use server';

import { cleanupExpiredStoredSessions } from '@/core/helpers/session';

export async function cleanupStoredSessionsAction() {
  await cleanupExpiredStoredSessions();
  return { success: true };
}
