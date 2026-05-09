'use server';

import { resolveGuestAccount } from '@/services/auth/guestAccount';

/**
 * Resolves the guest account cookie for the current request.
 *
 * This is the main entry point for guest account resolution. Call it at
 * every entry point where a browser first touches the server:
 *   - /bridge/handshake.v1/auth/grant
 *   - /bridge/silent.v1/auth/whoisthis
 *
 * @param linkedAccountId - The real account ID to link to when the user is
 *                          authenticated. Pass null for anonymous visitors.
 */
export async function resolveCookies(linkedAccountId: string | null = null): Promise<void> {
  await resolveGuestAccount(linkedAccountId);
}
