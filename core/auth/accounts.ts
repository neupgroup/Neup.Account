'use server';

// Provides read/write access to the auth_acc cookie.
// Each account entry is stored as a signed JWT (RS256).
// Format: auth_acc = JSON array of JWT strings.
//
// Guest accounts have guest: 1 in the payload (and no nid).
// The active account has def: 1 in the payload.

import { cookieProvider } from '@/core/providers/cookies';
import type { StoredAccount } from '@/core/auth/session';
import {
  signAccountToken,
  verifyAccountToken,
  serializeAccountTokens,
  deserializeAccountTokens,
  type AccountTokenPayload,
} from '@/core/auth/accountToken';

const ACCOUNTS_COOKIE_EXPIRY = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

const ACCOUNTS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function payloadToStoredAccount(p: AccountTokenPayload): StoredAccount {
  return {
    aid: p.aid,
    sid: p.sid,
    skey: p.skey,
    def: p.def ?? 0,
    nid: p.nid ?? '',
    neupId: p.nid ?? '',
    guest: p.guest,
  };
}

function storedAccountToPayload(
  a: StoredAccount,
  opts: { def?: 1; guest?: 1 } = {}
): AccountTokenPayload {
  const payload: AccountTokenPayload = {
    aid: a.aid,
    sid: a.sid ?? '',
    skey: a.skey ?? '',
    nid: a.nid ?? a.neupId ?? '',
  };
  if (opts.def) payload.def = 1;
  if (opts.guest || !payload.nid) payload.guest = 1;
  return payload;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Reads and verifies all account tokens from auth_acc.
 * Invalid/tampered tokens are silently dropped.
 */
export async function getAccounts(): Promise<StoredAccount[]> {
  const raw = await cookieProvider.getCookie('auth_acc');
  if (!raw) return [];

  const tokens = deserializeAccountTokens(raw);
  const results: StoredAccount[] = [];

  for (const token of tokens) {
    const payload = await verifyAccountToken(token);
    if (payload) {
      results.push(payloadToStoredAccount(payload));
    }
  }

  return results;
}

// Returns the account with def === 1, or null if none.
export async function getActiveAccount(): Promise<StoredAccount | null> {
  const accounts = await getAccounts();
  return accounts.find(a => a.def === 1) ?? null;
}

// Returns the ID of the account currently being managed (from the managing cookie).
export async function getManagedAccountId(): Promise<string | null> {
  const raw = await cookieProvider.getCookie('managing');
  return raw || null;
}

// Returns the effective active account ID.
export async function getEffectiveAccountId(): Promise<string | null> {
  const managing = await getManagedAccountId();
  if (managing) return managing;
  const active = await getActiveAccount();
  return active?.aid ?? null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Writes the full account list back to auth_acc as signed JWTs.
 */
async function writeAccounts(accounts: StoredAccount[]): Promise<void> {
  const tokens: string[] = [];

  for (const account of accounts) {
    const isActive = account.def === 1;
    const isGuest = !account.nid;
    const payload = storedAccountToPayload(
      account,
      { def: isActive ? 1 : undefined, guest: isGuest ? 1 : undefined }
    );
    const token = await signAccountToken(payload);
    tokens.push(token);
  }

  await cookieProvider.setCookieRaw(
    'auth_acc',
    serializeAccountTokens(tokens),
    { ...ACCOUNTS_COOKIE_OPTIONS, expires: ACCOUNTS_COOKIE_EXPIRY() }
  );
}

/**
 * Adds a new account to auth_acc and marks it as active (def: 1).
 * Demotes all other accounts to def: 0.
 * Pass nid = '' for guest accounts.
 */
export async function addAccount(
  aid: string,
  sid: string,
  skey: string,
  nid: string
): Promise<void> {
  const existing = await getAccounts();

  const others = existing
    .map(a => ({ ...a, def: 0 as const }))
    .filter(a => a.aid !== aid);

  const newAccount: StoredAccount = {
    aid,
    sid,
    skey,
    def: 1,
    nid,
    neupId: nid,
    guest: nid ? undefined : 1,
  };

  await writeAccounts([...others, newAccount]);
}

/**
 * Sets def: 1 on the account matching the given aid or index, def: 0 on all others.
 */
export async function updateDefaultAccount(
  identifier: string | number
): Promise<void> {
  const existing = await getAccounts();

  const updated = existing.map((a, index) => {
    const isTarget =
      typeof identifier === 'number' ? index === identifier : a.aid === identifier;
    return { ...a, def: (isTarget ? 1 : 0) as 0 | 1 };
  });

  await writeAccounts(updated);
}

/**
 * Removes all account entries that are missing aid, sid, or skey.
 */
export async function cleanAccounts(): Promise<void> {
  const existing = await getAccounts();
  const cleaned = existing.filter(a => a.aid && a.sid && a.skey);
  await writeAccounts(cleaned);
}
