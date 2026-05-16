/**
 * services/auth/accountJwt.ts
 *
 * Issues and verifies account-scoped JWTs for external API access.
 *
 * Flow:
 *   1. POST /bridge/api.v1/auth/token  { aid, sid, skey, appId }
 *      → validates session against DB
 *      → creates / confirms ApplicationConnection
 *      → returns a signed JWT (HS256, signed with Application.appSecret)
 *        payload: { aid, sid, skey, appId, iat, exp }
 *
 *   2. POST /bridge/api.v1/me  Authorization: Bearer <jwt>
 *      → verifies JWT signature with Application.appSecret
 *      → re-validates aid/sid/skey against DB (session must still be live)
 *      → returns full account info: profile, brand accounts, accessible accounts
 */

import jwt from 'jsonwebtoken';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import {
  getAccessableBrandAccountsWithCapabilities,
  getAccessableAccountsWithCapabilities,
  type AccountBasicsWithCapabilities,
} from '@/services/manage/accounts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccountJwtPayload = {
  aid: string;
  sid: string;
  skey: string;
  appId: string;
  iat?: number;
  exp?: number;
};

export type IssueTokenResult =
  | { status: 200; body: { success: true; token: string; exp: number } }
  | { status: 400 | 401 | 404 | 500; body: { success: false; error: string; error_description?: string } };

export type MeResult =
  | {
      status: 200;
      body: {
        success: true;
        account: {
          id: string;
          neupId: string | null;
          displayName: string | null;
          displayImage: string | null;
          accountType: string | null;
          verified: boolean;
          status: string | null;
        };
        brandAccounts: AccountBasicsWithCapabilities[];
        accessibleAccounts: AccountBasicsWithCapabilities[];
      };
    }
  | { status: 400 | 401 | 403 | 500; body: { success: false; error: string; error_description?: string } };

// ---------------------------------------------------------------------------
// Token lifetime
// ---------------------------------------------------------------------------

/** JWT lives for 7 days. Refresh by calling /auth/token again. */
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveAppSecret(appId: string): Promise<string | null> {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    select: { appSecret: true },
  });
  return app?.appSecret ?? null;
}

async function validateSession(aid: string, sid: string, skey: string): Promise<boolean> {
  const session = await prisma.authnSession.findUnique({
    where: { id: sid },
    select: { accountId: true, key: true, validTill: true },
  });

  return (
    !!session &&
    session.accountId === aid &&
    session.key === skey &&
    !!session.validTill &&
    session.validTill > new Date()
  );
}

// ---------------------------------------------------------------------------
// Issue token
// ---------------------------------------------------------------------------

/**
 * Validates the session triplet (aid, sid, skey) against the database,
 * ensures an ApplicationConnection exists, then issues a signed JWT.
 *
 * The JWT embeds aid, sid, skey so the /me endpoint can re-verify the
 * session on every request without the caller storing those values separately.
 */
export async function issueAccountToken(input: {
  aid?: string;
  sid?: string;
  skey?: string;
  appId?: string;
}): Promise<IssueTokenResult> {
  const { aid, sid, skey, appId } = input;

  if (!aid || !sid || !skey || !appId) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'invalid_request',
        error_description: 'aid, sid, skey, and appId are all required',
      },
    };
  }

  try {
    // 1. Validate session
    const sessionValid = await validateSession(aid, sid, skey);
    if (!sessionValid) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'invalid_session',
          error_description: 'Session not found, expired, or credentials do not match',
        },
      };
    }

    // 2. Resolve app secret
    const appSecret = await resolveAppSecret(appId);
    if (!appSecret) {
      return {
        status: 404,
        body: {
          success: false,
          error: 'app_not_found',
          error_description: 'Application not found or has no secret configured',
        },
      };
    }

    // 3. Ensure ApplicationConnection exists (upsert — safe to call repeatedly)
    await prisma.applicationConnection.upsert({
      where: { accountId_appId: { accountId: aid, appId } },
      update: {},
      create: { accountId: aid, appId, status: 'active' },
    });

    // 4. Sign JWT
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;

    const payload: AccountJwtPayload = { aid, sid, skey, appId, iat, exp };
    const token = jwt.sign(payload, appSecret, { algorithm: 'HS256' });

    return { status: 200, body: { success: true, token, exp } };
  } catch (error) {
    await logError('auth', error, `issueAccountToken:${aid}:${appId}`);
    return {
      status: 500,
      body: { success: false, error: 'internal_server_error' },
    };
  }
}

// ---------------------------------------------------------------------------
// Verify token and return account info
// ---------------------------------------------------------------------------

/**
 * Verifies the Bearer JWT, re-validates the embedded session against the DB,
 * then returns the full account profile + brand accounts + accessible accounts.
 *
 * The appId is extracted from the JWT payload — the caller does not need to
 * pass it separately (though they may pass it as a hint for the secret lookup).
 */
export async function resolveMe(input: {
  /** Raw Bearer token (without the "Bearer " prefix) */
  token: string;
  /** Optional appId hint — if omitted, extracted from the JWT payload */
  appId?: string;
}): Promise<MeResult> {
  const { token } = input;

  if (!token) {
    return {
      status: 400,
      body: { success: false, error: 'missing_token', error_description: 'Authorization header is required' },
    };
  }

  try {
    // 1. Decode without verification first to extract appId for secret lookup
    let unverifiedPayload: Partial<AccountJwtPayload>;
    try {
      unverifiedPayload = jwt.decode(token) as Partial<AccountJwtPayload>;
    } catch {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Token is malformed' },
      };
    }

    const appId = input.appId || unverifiedPayload?.appId;
    if (!appId) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Token missing appId claim' },
      };
    }

    // 2. Resolve app secret
    const appSecret = await resolveAppSecret(appId);
    if (!appSecret) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Application not found' },
      };
    }

    // 3. Verify signature + expiry
    let payload: AccountJwtPayload;
    try {
      payload = jwt.verify(token, appSecret, { algorithms: ['HS256'] }) as AccountJwtPayload;
    } catch (err) {
      const isExpired = err instanceof jwt.TokenExpiredError;
      return {
        status: 401,
        body: {
          success: false,
          error: isExpired ? 'token_expired' : 'invalid_token',
          error_description: isExpired ? 'Token has expired' : 'Token signature is invalid',
        },
      };
    }

    const { aid, sid, skey } = payload;

    if (!aid || !sid || !skey) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Token missing required claims' },
      };
    }

    // 4. Re-validate session against DB (session may have been revoked since token was issued)
    const sessionValid = await validateSession(aid, sid, skey);
    if (!sessionValid) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'session_invalid',
          error_description: 'The session embedded in this token is no longer valid',
        },
      };
    }

    // 5. Fetch account profile
    const account = await prisma.account.findUnique({
      where: { id: aid },
      select: {
        id: true,
        displayName: true,
        displayImage: true,
        accountType: true,
        status: true,
        isVerified: true,
        details: true,
        neupIds: { where: { isPrimary: true }, take: 1, select: { id: true } },
        individualProfile: { select: { firstName: true, lastName: true } },
        brandProfile: { select: { brandName: true } },
      },
    });

    if (!account) {
      return {
        status: 401,
        body: { success: false, error: 'account_not_found', error_description: 'Account no longer exists' },
      };
    }

    // Check for active block
    const details = account.details as Record<string, unknown> | null;
    const block = details?.block as { is_permanent?: boolean; until?: string | Date } | null;
    if (account.status === 'blocked' && block) {
      const isPermanent = block.is_permanent;
      const isTemporary = block.until && new Date(block.until) > new Date();
      if (isPermanent || isTemporary) {
        return {
          status: 403,
          body: { success: false, error: 'account_blocked', error_description: 'This account is currently blocked' },
        };
      }
    }

    const neupId = account.neupIds[0]?.id ?? null;
    const displayName =
      account.brandProfile?.brandName ||
      account.displayName ||
      [account.individualProfile?.firstName, account.individualProfile?.lastName]
        .filter(Boolean)
        .join(' ') ||
      null;

    // 6. Fetch brand accounts and all accessible accounts in parallel
    const [brandAccounts, accessibleAccounts] = await Promise.all([
      getAccessableBrandAccountsWithCapabilities(aid),
      getAccessableAccountsWithCapabilities(aid),
    ]);

    return {
      status: 200,
      body: {
        success: true,
        account: {
          id: account.id,
          neupId,
          displayName,
          displayImage: account.displayImage ?? null,
          accountType: account.accountType ?? null,
          verified: account.isVerified ?? false,
          status: account.status ?? null,
        },
        brandAccounts,
        accessibleAccounts,
      },
    };
  } catch (error) {
    await logError('auth', error, `resolveMe`);
    return {
      status: 500,
      body: { success: false, error: 'internal_server_error' },
    };
  }
}
