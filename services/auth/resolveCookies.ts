'use server';

import { cookies } from 'next/headers';
import { resolveOrCreateIdentityTrack } from '@/services/auth/silent-sso';
import { logError } from '@/core/helpers/logger';

export const TRACK_COOKIE = 'track';
const TRACK_COOKIE_MAX_AGE_YEARS = 1;

/**
 * Resolves the `track` cookie for the current request.
 *
 * - Reads the existing `track` cookie value
 * - Looks up the IdentityTrack in the database, or creates a new one
 * - Sets (or refreshes) the `track` cookie with a 1-year rolling expiry
 *
 * Call this at every entry point where a browser first touches the server:
 *   - /auth/* pages (via the auth layout)
 *   - /bridge/handshake.v1/auth/grant
 *   - /bridge/silent.v1/auth/whoisthis
 *
 * The middleware then uses the presence of this cookie as a gate — any
 * request to a non-entry-point path without a `track` cookie is redirected
 * to /auth/start.
 *
 * @param accountId - Pass the authenticated accountId to link the track to
 *                    the user's account. Pass null for anonymous visitors.
 */
export async function resolveCookies(accountId: string | null = null): Promise<void> {
  try {
    const cookieStore = await cookies();
    const existingTrackId = cookieStore.get(TRACK_COOKIE)?.value ?? null;

    const track = await resolveOrCreateIdentityTrack(existingTrackId, accountId);

    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + TRACK_COOKIE_MAX_AGE_YEARS);

    cookieStore.set(TRACK_COOKIE, track.id, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
  } catch (error) {
    // Non-fatal — a tracking failure should never break the page
    await logError('auth', error, 'resolve_cookies');
  }
}
