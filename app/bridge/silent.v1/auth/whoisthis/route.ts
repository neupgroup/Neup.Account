import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookies } from '@/core/helpers/cookies';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { resolveGuestAccount } from '@/services/auth/guestAccount';
import { COOKIE_GUEST_ACC } from '@/core/auth/constants';
import {
  checkRateLimit,
  validateSilentSsoOrigin,
  resolveOrCreateIdentity,
  issueSilentAuthCode,
  signIdentityJwt,
  buildIdentityDetails,
} from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

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
    window.parent.postMessage({ type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' }, ${JSON.stringify(targetOrigin)});
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

/**
 * GET /bridge/silent.v1/auth/whoisthis
 *
 * Always issues a signed JWT with an ssid — regardless of whether the user
 * is logged in or not. The guest account (guest_acc cookie) is the stable
 * device identifier. When authenticated, the guest account is linked to the
 * real account.
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
      { type: 'neupid:silent_auth', authenticated: false, reason: 'rate_limited' },
      origin || '*'
    );
  }

  // 3. Origin validation
  if (!origin) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'origin_not_registered' },
      '*'
    );
  }

  const { valid, appId } = await validateSilentSsoOrigin(origin);
  if (!valid || !appId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'origin_not_registered' },
      '*'
    );
  }

  const targetOrigin = new URL(origin).origin;

  // 4. Session check
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

  // 5. Resolve guest account (creates or links it)
  await resolveGuestAccount(isAuthenticated ? (accountId || null) : null);

  const cookieStore = await cookies();
  const guestAccountId = cookieStore.get(COOKIE_GUEST_ACC)?.value ?? null;

  if (!guestAccountId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 6. Resolve Identity for (guestAccountId, appId)
  let identity;
  try {
    identity = await resolveOrCreateIdentity(guestAccountId, appId);
  } catch (error) {
    await logError('auth', error, 'whoisthis_resolve_identity');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 7. Sign JWT
  const details = isAuthenticated && accountId
    ? await buildIdentityDetails(accountId)
    : [];

  let token: string;
  try {
    token = await signIdentityJwt(identity, appId, details);
  } catch (error) {
    await logError('auth', error, 'whoisthis_sign_jwt');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // 8. Authenticated — issue code for server exchange
  if (isAuthenticated && accountId && sessionId) {
    const { searchParams } = new URL(request.url);
    const codeChallenge = searchParams.get('codeChallenge') ?? undefined;
    const codeChallengeMethod = searchParams.get('codeChallengeMethod') ?? undefined;

    try {
      const { code } = await issueSilentAuthCode(
        accountId,
        guestAccountId,
        appId,
        codeChallenge,
        codeChallengeMethod
      );
      return buildHtmlResponse(
        { type: 'neupid:silent_auth', authenticated: true, token, code },
        targetOrigin
      );
    } catch (error) {
      await logError('auth', error, 'whoisthis_issue_code');
      return buildHtmlResponse(
        { type: 'neupid:silent_auth', authenticated: true, token },
        targetOrigin
      );
    }
  }

  // 9. Unauthenticated — JWT only, no code
  return buildHtmlResponse(
    { type: 'neupid:silent_auth', authenticated: false, token },
    targetOrigin
  );
}
