import { NextRequest } from 'next/server';
import { getSessionCookies } from '@/core/helpers/cookies';
import { getAccounts } from '@/core/auth/accounts';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { resolveGuestAccount } from '@/services/auth/guestAccount';
import jwt from 'jsonwebtoken';
import {
  checkRateLimit,
  validateSilentSsoOrigin,
  resolveOrCreateIdentity,
  buildIdentityDetails,
  ensureApplicationConnection,
  issueSilentAuthCode,
} from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHtmlResponse(payload: object, targetOrigin: string): Response {
  const payloadJson = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="sso-payload" data-payload="${payloadJson.replace(/"/g, '&quot;')}"></div>
<script>
(function() {
  try {
    var el = document.getElementById('sso-payload');
    var payload = JSON.parse(el.getAttribute('data-payload'));
    window.parent.postMessage(payload, ${JSON.stringify(targetOrigin)});
  } catch(e) {
    window.parent.postMessage({ type: 'neupid:silent_auth', success: false, reason: 'internal_error' }, ${JSON.stringify(targetOrigin)});
  }
})();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// Token lifetime: 7 days
// ---------------------------------------------------------------------------

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /bridge/silent.v1/whoisthis?app=[id]
 *
 * Single silent-auth entry point. No separate init step needed — guest
 * account initialization runs automatically here.
 *
 * Responds via postMessage with:
 * {
 *   type:     'neupid:silent_auth',
 *   success:  boolean,
 *   token:    { cid, aid?, iat, exp }   — aid included only for party 1 or 2
 *   response: { ...account info }       — empty object when unauthenticated
 * }
 *
 * Party rules (Application.party):
 *   1 or 2 → token includes { cid, aid, iat, exp }
 *   3 or 4 → token includes { cid, iat, exp }  (aid omitted)
 *
 * When the token expires the caller reloads this iframe to get a fresh one.
 */
export async function GET(request: NextRequest): Promise<Response> {
  // 1. Resolve origin
  let origin = request.headers.get('origin') ?? '';
  if (!origin) {
    const referer = request.headers.get('referer') ?? '';
    if (referer) {
      try { origin = new URL(referer).origin; } catch { origin = ''; }
    }
  }

  // 2. Rate limit
  if (!checkRateLimit(origin || 'unknown')) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'rate_limited' },
      origin || '*'
    );
  }

  // 3. Origin validation
  if (!origin) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'origin_not_registered' },
      '*'
    );
  }

  const { valid, appId: originAppId } = await validateSilentSsoOrigin(origin);
  if (!valid || !originAppId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'origin_not_registered' },
      '*'
    );
  }

  // 4. Optionally override appId via ?app= query param (must still match the
  //    registered origin's app to prevent cross-app token issuance).
  const { searchParams } = new URL(request.url);
  const queryAppId = searchParams.get('app');
  const appId = queryAppId ?? originAppId;

  if (queryAppId && queryAppId !== originAppId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'app_mismatch' },
      new URL(origin).origin
    );
  }

  const targetOrigin = new URL(origin).origin;

  // 5. Load application (need appSecret + party)
  let application: { appSecret: string | null; party: number } | null;
  try {
    application = await prisma.application.findUnique({
      where: { id: appId },
      select: { appSecret: true, party: true },
    });
  } catch (error) {
    await logError('auth', error, 'whoisthis_load_application');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  if (!application || !application.appSecret) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'app_not_found' },
      targetOrigin
    );
  }

  const { appSecret, party } = application;

  // 6. Session check
  const { accountId, sessionId, sessionKey } = await getSessionCookies();
  let isAuthenticated = false;

  if (accountId && sessionId && sessionKey) {
    try {
      const session = await prisma.authnSession.findUnique({
        where: { id: sessionId },
        select: { accountId: true, key: true, validTill: true },
      });
      isAuthenticated =
        !!session &&
        session.accountId === accountId &&
        session.key === sessionKey &&
        !!session.validTill &&
        session.validTill > new Date();
    } catch (error) {
      await logError('auth', error, 'whoisthis_session_check');
    }
  }

  // 7. Initialize guest account if needed
  await resolveGuestAccount(isAuthenticated ? (accountId || null) : null);

  const allAccounts = await getAccounts();
  const guestEntry = allAccounts.find(a => a.def === 1 && !a.nid);
  const guestAccountId = guestEntry?.aid ?? null;

  if (!guestAccountId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 8. Resolve Identity for (guestAccountId, appId)
  let identity;
  try {
    identity = await resolveOrCreateIdentity(guestAccountId, appId);
  } catch (error) {
    await logError('auth', error, 'whoisthis_resolve_identity');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 9. Build token payload based on party
  //    Party 1 or 2 → include aid (account ID)
  //    Party 3 or 4 → omit aid
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SECONDS;

  let cid: string | null = null;

  if (isAuthenticated && accountId) {
    // Ensure ApplicationConnection exists and get its stable ID
    try {
      const connection = await prisma.applicationConnection.upsert({
        where: { accountId_appId: { accountId, appId } },
        update: {},
        create: { accountId, appId, status: 'active' },
        select: { id: true },
      });
      cid = connection.id;
    } catch (error) {
      await logError('auth', error, 'whoisthis_upsert_connection');
    }
  }

  const includeAid = party === 1 || party === 2;

  const tokenPayload: Record<string, unknown> = {
    cid: cid ?? identity.id,
    iat,
    exp,
  };

  if (includeAid && isAuthenticated && accountId) {
    tokenPayload.aid = accountId;
  }

  let signedToken: string;
  try {
    signedToken = jwt.sign(tokenPayload, appSecret, { algorithm: 'HS256' });
  } catch (error) {
    await logError('auth', error, 'whoisthis_sign_token');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', success: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 10. Build response (account info) — only when authenticated
  let response: Record<string, unknown> = {};

  if (isAuthenticated && accountId) {
    try {
      const details = await buildIdentityDetails(accountId);
      // Convert details array to a flat key→value map for convenience
      for (const { key, value } of details) {
        response[key] = value;
      }
    } catch (error) {
      await logError('auth', error, 'whoisthis_build_response');
      // Non-fatal — return empty response rather than failing
    }

    // Ensure ApplicationConnection is recorded
    await ensureApplicationConnection(accountId, appId);
  }

  // 11. Return result
  return buildHtmlResponse(
    {
      type: 'neupid:silent_auth',
      success: isAuthenticated,
      token: tokenPayload,
      response,
    },
    targetOrigin
  );
}
