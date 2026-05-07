import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Identity } from '@/prisma/generated/client';

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

type RateLimitEntry = { count: number; windowStart: number };
export const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * In-memory rate limiter: 10 requests per origin per minute.
 * Returns true if the request should be allowed, false if rate-limited.
 */
export function checkRateLimit(origin: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(origin);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(origin, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// Origin validation
// ---------------------------------------------------------------------------

/**
 * Validates an incoming origin against ApplicationBridge records of type 'silentSsoOrigin'.
 * Matches by scheme + host only (ignoring path and query string).
 */
export async function validateSilentSsoOrigin(
  origin: string
): Promise<{ valid: boolean; appId: string | null }> {
  try {
    const records = await prisma.applicationBridge.findMany({
      where: { type: 'silentSsoOrigin' },
    });

    for (const record of records) {
      try {
        const registeredOrigin = new URL(record.value).origin;
        const requestOrigin = new URL(origin).origin;
        if (registeredOrigin === requestOrigin) {
          return { valid: true, appId: record.appId };
        }
      } catch {
        // Skip malformed URL entries
      }
    }

    return { valid: false, appId: null };
  } catch (error) {
    await logError('auth', error, 'validate_silent_sso_origin');
    return { valid: false, appId: null };
  }
}

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

/**
 * Looks up an existing Identity for (accountId, appId) or creates one.
 * Sets validTill = now + 4 weeks, refreshesOn = now + 1 hour.
 * Updates sessionId to the current session on each call.
 */
export async function resolveOrCreateIdentity(
  accountId: string | null,
  appId: string,
  sessionId: string | null
): Promise<Identity> {
  const now = new Date();
  const refreshesOn = new Date(now.getTime() + 3_600_000); // +1 hour
  const validTill = new Date(now.getTime() + 4 * 7 * 24 * 3_600_000); // +4 weeks

  // When accountId is null, we cannot use the unique constraint (accountId, appId)
  // reliably for upsert, so fall back to findFirst + create.
  if (accountId === null) {
    const existing = await prisma.identity.findFirst({
      where: { accountId: null, appId },
    });

    if (existing) {
      return prisma.identity.update({
        where: { id: existing.id },
        data: { sessionId },
      });
    }

    return prisma.identity.create({
      data: {
        accountId: null,
        appId,
        sessionId,
        originatedOn: now,
        refreshesOn,
        validTill,
      },
    });
  }

  return prisma.identity.upsert({
    where: { accountId_appId: { accountId, appId } },
    create: {
      accountId,
      appId,
      sessionId,
      originatedOn: now,
      refreshesOn,
      validTill,
    },
    update: {
      sessionId,
    },
  });
}

// ---------------------------------------------------------------------------
// JWT signing
// ---------------------------------------------------------------------------

/**
 * Signs a JWT with the application's appSecret (HS256).
 * Payload: { ssid, sid, originated_on, refreshes_on, expires_on }
 * No exp claim — the expires_on field is the canonical expiry.
 */
export async function signIdentityJwt(identity: Identity, appId: string): Promise<string> {
  const application = await prisma.application.findUnique({
    where: { id: appId },
    select: { appSecret: true },
  });

  if (!application || !application.appSecret) {
    throw new Error(`Application ${appId} not found or has no appSecret`);
  }

  const payload = {
    ssid: identity.id,
    sid: identity.sessionId ?? null,
    originated_on: identity.originatedOn.toISOString(),
    refreshes_on: identity.refreshesOn.toISOString(),
    expires_on: identity.validTill.toISOString(),
  };

  return jwt.sign(payload, application.appSecret, { algorithm: 'HS256' });
}

// ---------------------------------------------------------------------------
// Silent auth code issuance
// ---------------------------------------------------------------------------

/**
 * Issues a short-lived silent_auth_code stored in AuthnRequest.
 * Returns the code and the resolved Identity.
 */
export async function issueSilentAuthCode(
  accountId: string,
  appId: string,
  sessionId: string,
  codeChallenge?: string,
  codeChallengeMethod?: string
): Promise<{ code: string; identity: Identity }> {
  const code = crypto.randomBytes(48).toString('base64url');

  await prisma.authnRequest.create({
    data: {
      id: code,
      type: 'silent_auth_code',
      status: 'pending',
      data: {
        appId,
        sessionId,
        ...(codeChallenge
          ? {
              codeChallenge,
              codeChallengeMethod: codeChallengeMethod ?? 'S256',
            }
          : {}),
      },
      accountId,
      expiresAt: new Date(Date.now() + 300_000),
    },
  });

  const identity = await resolveOrCreateIdentity(accountId, appId, sessionId);

  return { code, identity };
}

// ---------------------------------------------------------------------------
// Silent auth code exchange
// ---------------------------------------------------------------------------

/**
 * Exchanges a silent_auth_code for a full user identity.
 * Validates appId + appSecret, marks code as used, returns WhoAmI-style body.
 */
export async function exchangeSilentAuthCode(
  appId: string,
  appSecret: string,
  code: string,
  codeVerifier?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    // Look up the pending code
    const record = await prisma.authnRequest.findFirst({
      where: { id: code, type: 'silent_auth_code', status: 'pending' },
    });

    if (!record) {
      return { status: 400, body: { success: false, error: 'invalid_code' } };
    }

    if (record.expiresAt <= new Date()) {
      return { status: 400, body: { success: false, error: 'invalid_code' } };
    }

    const data = record.data as {
      appId: string;
      sessionId: string;
      codeChallenge?: string;
      codeChallengeMethod?: string;
    };

    // Validate appId binding
    if (data.appId !== appId) {
      return { status: 400, body: { success: false, error: 'app_mismatch' } };
    }

    // Validate appSecret
    const application = await prisma.application.findUnique({
      where: { id: appId },
      select: { appSecret: true },
    });

    if (!application || application.appSecret !== appSecret) {
      return { status: 401, body: { success: false, error: 'unauthorized' } };
    }

    // PKCE verification
    if (data.codeChallenge && codeVerifier) {
      const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      if (hash !== data.codeChallenge) {
        return { status: 400, body: { success: false, error: 'invalid_code_verifier' } };
      }
    }

    // Atomically mark the code as used
    const updated = await prisma.authnRequest.updateMany({
      where: { id: code, status: 'pending' },
      data: { status: 'used' },
    });

    // If nothing was updated, the code was consumed by a concurrent request
    if (updated.count === 0) {
      return { status: 400, body: { success: false, error: 'invalid_code' } };
    }

    // Fetch the account details (same shape as resolveWhoAmI)
    const account = await prisma.account.findUnique({
      where: { id: record.accountId! },
      select: {
        id: true,
        status: true,
        displayName: true,
        displayImage: true,
        isVerified: true,
        accountType: true,
        details: true,
        neupIds: { where: { isPrimary: true }, take: 1, select: { id: true } },
        individualProfile: { select: { firstName: true, lastName: true } },
        brandProfile: { select: { brandName: true } },
      },
    });

    if (!account) {
      return { status: 400, body: { success: false, error: 'invalid_code' } };
    }

    const neupId = account.neupIds[0]?.id ?? null;
    const displayName =
      account.brandProfile?.brandName ||
      account.displayName ||
      [account.individualProfile?.firstName, account.individualProfile?.lastName]
        .filter(Boolean)
        .join(' ') ||
      null;

    // Log the exchange event (without the code value)
    await logError('auth', `silent_auth_code exchanged for appId=${appId}, outcome=success`, 'exchange_silent_auth_code');

    return {
      status: 200,
      body: {
        success: true,
        accountId: account.id,
        neupId,
        displayName,
        displayImage: account.displayImage || null,
        accountType: account.accountType || null,
        verified: account.isVerified ?? false,
      },
    };
  } catch (error) {
    await logError('auth', error, 'exchange_silent_auth_code');
    return { status: 500, body: { success: false, error: 'internal_server_error' } };
  }
}
