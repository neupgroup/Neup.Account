import type { NextRequest } from 'next/server';

/**
 * The three possible outcomes of handleAuthData.
 *
 * create_guest  — No account in cookies at all. The caller should redirect
 *                 to /auth/start so a guest account can be created.
 *
 * redirect      — An account entry exists but it is a guest (no nid).
 *                 The user cannot access protected pages as a guest.
 *                 The caller should redirect to /auth/start.
 *
 * permit        — A permanent account (has nid) with valid aid/sid/skey
 *                 is active. The caller should let the request through.
 */
export type AuthDataResult =
  | { outcome: 'create_guest' }
  | { outcome: 'redirect'; reason: 'guest_account' | 'invalid_session' }
  | { outcome: 'permit'; accountId: string };

/**
 * handleAuthData
 *
 * Reads the auth_acc cookie (or the Authorization header for API requests)
 * and determines what to do with the request.
 *
 * Conditions:
 *   1. No account found          → create_guest
 *   2. Account found, no nid     → redirect (guest account, not permitted)
 *   3. Account found, has nid,
 *      valid aid/sid/skey        → permit
 *   4. Account found, has nid,
 *      missing aid/sid/skey      → redirect (invalid session)
 *
 * This function is Edge-compatible — no DB calls, reads cookies/headers only.
 */
export function handleAuthData(request: NextRequest): AuthDataResult {
  // Try to read from the auth_acc cookie first
  const authAccRaw = request.cookies.get('auth_acc')?.value;

  let activeAccount: {
    aid?: string;
    sid?: string;
    skey?: string;
    nid?: string;
    def?: number;
  } | null = null;

  if (authAccRaw) {
    try {
      const accounts = JSON.parse(authAccRaw);
      if (Array.isArray(accounts)) {
        activeAccount = accounts.find(
          (a: any) => a?.def === 1
        ) ?? null;
      }
    } catch {
      // Malformed cookie — treat as no account
    }
  }

  // Fallback: check Authorization header (for API / programmatic requests)
  // Format: "Bearer aid:sid:skey:nid" or just check for presence
  if (!activeAccount) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const parts = token.split(':');
      if (parts.length >= 3) {
        activeAccount = {
          aid: parts[0],
          sid: parts[1],
          skey: parts[2],
          nid: parts[3] ?? '',
          def: 1,
        };
      }
    }
  }

  // Condition 1: No account at all
  if (!activeAccount) {
    return { outcome: 'create_guest' };
  }

  const { aid, sid, skey, nid } = activeAccount;

  // Condition 2: Guest account (no nid) — cannot access protected pages
  if (!nid) {
    return { outcome: 'redirect', reason: 'guest_account' };
  }

  // Condition 3 & 4: Permanent account — check session fields
  if (!aid || !sid || !skey) {
    return { outcome: 'redirect', reason: 'invalid_session' };
  }

  // Condition 3: Permanent account with valid session
  return { outcome: 'permit', accountId: aid };
}
