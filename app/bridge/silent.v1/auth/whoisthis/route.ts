import { NextRequest } from 'next/server';
import { getSessionCookies } from '@/core/helpers/cookies';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import {
  checkRateLimit,
  validateSilentSsoOrigin,
  issueSilentAuthCode,
  signIdentityJwt,
} from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

/**
 * Builds an HTML response that dispatches a postMessage to the parent window.
 *
 * The payload is injected as a data attribute on a <div> element, and an
 * inline <script> reads it and calls window.parent.postMessage. This approach
 * avoids inline JSON in script tags (XSS-safe via attribute encoding).
 *
 * @param payload  - The postMessage payload object.
 * @param targetOrigin - The exact registered origin to target. Use "*" only
 *                       when the origin is unknown (unregistered origin case).
 */
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
 * Iframe-embeddable endpoint for silent SSO. Reads the session cookie,
 * validates the requesting origin, and dispatches a postMessage to the
 * parent window with either a signed JWT + auth code (success) or a
 * typed failure reason.
 *
 * Always returns HTTP 200 — failures are communicated via the postMessage
 * payload, not via HTTP status codes, so the iframe always loads.
 *
 * Query params:
 *   codeChallenge?       - PKCE S256 challenge
 *   codeChallengeMethod? - Must be "S256" if provided
 */
export async function GET(request: NextRequest): Promise<Response> {
  // -------------------------------------------------------------------------
  // 1. Resolve the requesting origin from Origin or Referer header
  // -------------------------------------------------------------------------
  let origin = request.headers.get('origin') ?? '';

  if (!origin) {
    const referer = request.headers.get('referer') ?? '';
    if (referer) {
      try {
        origin = new URL(referer).origin;
      } catch {
        origin = '';
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Rate limit check
  // -------------------------------------------------------------------------
  if (!checkRateLimit(origin || 'unknown')) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'rate_limited' },
      origin || '*'
    );
  }

  // -------------------------------------------------------------------------
  // 3. Origin validation — must be a registered silentSsoOrigin
  // -------------------------------------------------------------------------
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

  // From this point on we know the exact registered origin, so we can use it
  // as the postMessage targetOrigin (never "*").
  const targetOrigin = new URL(origin).origin;

  // -------------------------------------------------------------------------
  // 4. Session validation
  // -------------------------------------------------------------------------
  const { accountId, sessionId, sessionKey } = await getSessionCookies();

  if (!accountId || !sessionId || !sessionKey) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'no_session' },
      targetOrigin
    );
  }

  // -------------------------------------------------------------------------
  // 5. Validate session against the database
  // -------------------------------------------------------------------------
  try {
    const session = await prisma.authnSession.findUnique({
      where: { id: sessionId },
      select: { accountId: true, key: true, validTill: true },
    });

    if (
      !session ||
      session.accountId !== accountId ||
      session.key !== sessionKey ||
      !session.validTill ||
      session.validTill <= new Date()
    ) {
      return buildHtmlResponse(
        { type: 'neupid:silent_auth', authenticated: false, reason: 'session_invalid' },
        targetOrigin
      );
    }
  } catch (error) {
    await logError('auth', error, 'whoisthis_session_check');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'session_invalid' },
      targetOrigin
    );
  }

  // -------------------------------------------------------------------------
  // 6. Read PKCE params from query string
  // -------------------------------------------------------------------------
  const { searchParams } = new URL(request.url);
  const codeChallenge = searchParams.get('codeChallenge') ?? undefined;
  const codeChallengeMethod = searchParams.get('codeChallengeMethod') ?? undefined;

  // -------------------------------------------------------------------------
  // 7. Issue silent auth code and sign identity JWT
  // -------------------------------------------------------------------------
  try {
    const { code, identity } = await issueSilentAuthCode(
      accountId,
      appId,
      sessionId,
      codeChallenge,
      codeChallengeMethod
    );

    const token = await signIdentityJwt(identity, appId);

    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: true, token, code },
      targetOrigin
    );
  } catch (error) {
    await logError('auth', error, 'whoisthis_issue_code');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'session_invalid' },
      targetOrigin
    );
  }
}
