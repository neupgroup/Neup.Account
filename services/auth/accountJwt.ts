/**
 * services/auth/accountJwt.ts
 *
 * Issues and verifies account-scoped JWTs for external API access.
 *
 * Token shape: { cid, iat, exp }
 *   cid — ApplicationConnection.id (the stable link between an account and an app)
 *
 * /me endpoint supports two auth modes:
 *
 *   Mode A — Bearer JWT (external / third-party apps)
 *     Authorization: Bearer <token>
 *     Token contains cid. Server resolves accountId + appId from the connection.
 *
 *   Mode B — Session triplet + app_id query param (Neup Group internal apps)
 *     POST /bridge/api.v1/me?app_id=<appId>
 *     Body: { aid, sid, skey }
 *     Server validates the session directly, no JWT needed.
 *
 * In both cases the response is shaped by the access fields configured on the
 * Application (Application.details.access). Only fields the app has declared
 * are included in the response.
 */

import jwt from 'jsonwebtoken';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import type { ApplicationAccessField } from '@/services/applications/types';
import {
  getAccessableBrandAccountsWithCapabilities,
  getAccessableAccountsWithCapabilities,
  type AccountBasicsWithCapabilities,
} from '@/services/manage/accounts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** What's inside the JWT — minimal by design. */
export type AccountJwtPayload = {
  cid: string;   // ApplicationConnection.id
  iat?: number;
  exp?: number;
};

export type IssueTokenResult =
  | { status: 200; body: { success: true; token: string; exp: number } }
  | { status: 400 | 401 | 404 | 500; body: { success: false; error: string; error_description?: string } };

export type MeAccountData = {
  connectionId?: string;
  accountId?: string;
  displayName?: string | null;
  displayImage?: string | null;
  accountType?: string | null;
  lastActive?: string | null;
  neupid?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  dateBirth?: string | null;
  age?: number | null;
  isMinor?: boolean | null;
  gender?: string | null;
};

export type MeResult =
  | {
      status: 200;
      body: {
        success: true;
        account: MeAccountData;
        brandAccounts: AccountBasicsWithCapabilities[];
        accessibleAccounts: AccountBasicsWithCapabilities[];
      };
    }
  | { status: 400 | 401 | 403 | 500; body: { success: false; error: string; error_description?: string } };

// ---------------------------------------------------------------------------
// Token lifetime
// ---------------------------------------------------------------------------

/** JWT lives for 7 days. Re-issue by calling /auth/token again. */
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

/**
 * Resolves the configured access fields for an application.
 * Falls back to a safe minimal set if none are configured.
 */
async function resolveAccessFields(appId: string): Promise<ApplicationAccessField[]> {
  const app = await prisma.application.findUnique({
    where: { id: appId },
    select: { details: true },
  });
  const raw = (app?.details as Record<string, unknown> | null)?.access;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw as ApplicationAccessField[];
  }
  // Default minimal set
  return ['connectionId', 'accountId', 'displayName', 'displayImage', 'accountType'];
}

/**
 * Builds the account data object filtered to only the fields the app has
 * declared in its access configuration.
 */
async function buildAccountData(
  accountId: string,
  connectionId: string,
  accessFields: ApplicationAccessField[]
): Promise<MeAccountData> {
  const fieldSet = new Set(accessFields);

  // Determine which DB fields we actually need to fetch
  const needsProfile = fieldSet.has('firstName') || fieldSet.has('lastName') ||
    fieldSet.has('middleName') || fieldSet.has('dateBirth') ||
    fieldSet.has('age') || fieldSet.has('isMinor') || fieldSet.has('gender');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      displayName: true,
      displayImage: true,
      accountType: true,
      details: true,
      neupIds: fieldSet.has('neupid')
        ? { where: { isPrimary: true }, take: 1, select: { id: true } }
        : false,
      individualProfile: needsProfile
        ? {
            select: {
              firstName: true,
              lastName: true,
              middleName: true,
              dateOfBirth: true,
            },
          }
        : false,
      brandProfile: {
        select: { brandName: true },
      },
    },
  });

  if (!account) return {};

  const displayName =
    account.brandProfile?.brandName ||
    account.displayName ||
    null;

  const data: MeAccountData = {};

  if (fieldSet.has('connectionId')) data.connectionId = connectionId;
  if (fieldSet.has('accountId'))    data.accountId    = account.id;
  if (fieldSet.has('displayName'))  data.displayName  = displayName;
  if (fieldSet.has('displayImage')) data.displayImage = account.displayImage ?? null;
  if (fieldSet.has('accountType'))  data.accountType  = account.accountType ?? null;
  if (fieldSet.has('neupid'))       data.neupid       = account.neupIds?.[0]?.id ?? null;

  if (fieldSet.has('firstName'))    data.firstName    = account.individualProfile?.firstName ?? null;
  if (fieldSet.has('lastName'))     data.lastName     = account.individualProfile?.lastName ?? null;
  if (fieldSet.has('middleName'))   data.middleName   = account.individualProfile?.middleName ?? null;

  if (fieldSet.has('dateBirth') || fieldSet.has('age') || fieldSet.has('isMinor')) {
    const dob = account.individualProfile?.dateOfBirth ?? null;
    if (fieldSet.has('dateBirth')) data.dateBirth = dob ? dob.toISOString().split('T')[0] : null;
    if (fieldSet.has('age') || fieldSet.has('isMinor')) {
      const age = dob
        ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
        : null;
      if (fieldSet.has('age'))     data.age     = age;
      if (fieldSet.has('isMinor')) data.isMinor = age !== null ? age < 18 : null;
    }
  }

  if (fieldSet.has('lastActive')) {
    const activity = await prisma.activity.findFirst({
      where: { targetAccountId: accountId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    data.lastActive = activity?.timestamp?.toISOString() ?? null;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Issue token  (Mode A — external apps)
// ---------------------------------------------------------------------------

/**
 * Validates the session triplet (aid, sid, skey), ensures an
 * ApplicationConnection exists, then issues a JWT containing only { cid, iat, exp }.
 *
 * The JWT is signed with Application.appSecret (HS256).
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

    // 3. Ensure ApplicationConnection exists — get its ID
    const connection = await prisma.applicationConnection.upsert({
      where: { accountId_appId: { accountId: aid, appId } },
      update: {},
      create: { accountId: aid, appId, status: 'active' },
      select: { id: true },
    });

    // 4. Sign JWT — only cid, iat, exp
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;

    const payload: AccountJwtPayload = { cid: connection.id, iat, exp };
    const token = jwt.sign(payload, appSecret, { algorithm: 'HS256' });

    return { status: 200, body: { success: true, token, exp } };
  } catch (error) {
    await logError('auth', error, `issueAccountToken:${aid}:${appId}`);
    return { status: 500, body: { success: false, error: 'internal_server_error' } };
  }
}

// ---------------------------------------------------------------------------
// Resolve /me — Mode A: Bearer JWT
// ---------------------------------------------------------------------------

/**
 * Verifies the Bearer JWT, resolves the ApplicationConnection to get
 * accountId + appId, then returns account data shaped by the app's
 * configured access fields.
 */
export async function resolveMeFromToken(token: string): Promise<MeResult> {
  if (!token) {
    return {
      status: 400,
      body: { success: false, error: 'missing_token', error_description: 'Authorization header is required' },
    };
  }

  try {
    // 1. Decode without verification to get cid, then look up the connection
    //    to find the appId needed for the secret.
    let unverified: Partial<AccountJwtPayload>;
    try {
      unverified = jwt.decode(token) as Partial<AccountJwtPayload>;
    } catch {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Token is malformed' },
      };
    }

    const cid = unverified?.cid;
    if (!cid) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Token missing cid claim' },
      };
    }

    // 2. Look up the connection to get appId (needed for secret)
    const connection = await prisma.applicationConnection.findUnique({
      where: { id: cid },
      select: { id: true, accountId: true, appId: true, status: true },
    });

    if (!connection) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Connection not found' },
      };
    }

    // 3. Verify signature + expiry
    const appSecret = await resolveAppSecret(connection.appId);
    if (!appSecret) {
      return {
        status: 401,
        body: { success: false, error: 'invalid_token', error_description: 'Application not found' },
      };
    }

    try {
      jwt.verify(token, appSecret, { algorithms: ['HS256'] });
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

    return resolveMeForConnection(connection.id, connection.accountId, connection.appId);
  } catch (error) {
    await logError('auth', error, 'resolveMeFromToken');
    return { status: 500, body: { success: false, error: 'internal_server_error' } };
  }
}

// ---------------------------------------------------------------------------
// Resolve /me — Mode B: Session triplet + app_id query param
// ---------------------------------------------------------------------------

/**
 * Validates aid/sid/skey directly against the DB (no JWT needed).
 * Used by Neup Group internal apps that already hold the session triplet.
 * appId is passed as a URL query parameter (?app_id=...).
 */
export async function resolveMeFromSession(input: {
  aid?: string;
  sid?: string;
  skey?: string;
  appId?: string;
}): Promise<MeResult> {
  const { aid, sid, skey, appId } = input;

  if (!aid || !sid || !skey) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'invalid_request',
        error_description: 'aid, sid, and skey are required in the request body',
      },
    };
  }

  if (!appId) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'invalid_request',
        error_description: 'app_id query parameter is required',
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

    // 2. Ensure connection exists (upsert)
    const connection = await prisma.applicationConnection.upsert({
      where: { accountId_appId: { accountId: aid, appId } },
      update: {},
      create: { accountId: aid, appId, status: 'active' },
      select: { id: true },
    });

    return resolveMeForConnection(connection.id, aid, appId);
  } catch (error) {
    await logError('auth', error, `resolveMeFromSession:${aid}:${appId}`);
    return { status: 500, body: { success: false, error: 'internal_server_error' } };
  }
}

// ---------------------------------------------------------------------------
// Shared resolution — used by both modes
// ---------------------------------------------------------------------------

async function resolveMeForConnection(
  connectionId: string,
  accountId: string,
  appId: string
): Promise<MeResult> {
  // 1. Check account exists and is not blocked
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { status: true, details: true },
  });

  if (!account) {
    return {
      status: 401,
      body: { success: false, error: 'account_not_found', error_description: 'Account no longer exists' },
    };
  }

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

  // 2. Resolve access fields configured on the app
  const accessFields = await resolveAccessFields(appId);

  // 3. Build filtered account data + accessible accounts in parallel
  const [accountData, brandAccounts, accessibleAccounts] = await Promise.all([
    buildAccountData(accountId, connectionId, accessFields),
    getAccessableBrandAccountsWithCapabilities(accountId),
    getAccessableAccountsWithCapabilities(accountId),
  ]);

  return {
    status: 200,
    body: {
      success: true,
      account: accountData,
      brandAccounts,
      accessibleAccounts,
    },
  };
}
