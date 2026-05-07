import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionCookies } from '@/core/helpers/cookies';
import prisma from '@/core/helpers/prisma';
import { logError } from '@/core/helpers/logger';
import { resolveCookies } from '@/services/auth/resolveCookies';
import {
  checkRateLimit,
  validateSilentSsoOrigin,
  resolveOrCreateIdentityTrack,
  resolveOrCreateIdentity,
  issueSilentAuthCode,
  signIdentityJwt,
  buildIdentityDetails,
} from '@/services/auth/silent-sso';

export const dynamic = 'force-dynamic';

/**
 * Builds an HTML response that dispatches a postMessage to the parent window.
 * The payload is injected as a data attribute and read by an inline script.
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
 * Always issues a signed JWT with an ssid — regardless of whether the user
 * is logged in or not. The `authenticated` flag in the postMessage payload
 * tells the app whether the person is identified (has a linked account) or
 * anonymous (tracked but unknown).
 *
 * Logged in:
 *   - IdentityTrack is linked to the accountId
 *   - authenticated: true
 *   - token: { ssid, expires_on, refreshes_on }
 *   - code: short-lived auth code for server-to-server exchange
 *
 * Not logged in:
 *   - IdentityTrack has no accountId (anonymous)
 *   - authenticated: false
 *   - token: { ssid, expires_on, refreshes_on }
 *   - no code (nothing to exchange server-side)
 *
 * The track cookie on neupgroup.com ties the IdentityTrack across all visits,
 * so the same ssid is returned for the same person on the same app — even
 * before they ever create an account.
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

  // From this point on we know the exact registered origin.
  const targetOrigin = new URL(origin).origin;

  // -------------------------------------------------------------------------
  // 4. Read session cookies (track cookie resolved in step 6)
  // -------------------------------------------------------------------------
  const { accountId, sessionId, sessionKey } = await getSessionCookies();

  // -------------------------------------------------------------------------
  // 5. Check if the session is valid (determines authenticated: true/false)
  //    We do this before resolving the track so we know whether to link it.
  // -------------------------------------------------------------------------
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
      // Treat as unauthenticated — still issue an anonymous ssid below
    }
  }

  // -------------------------------------------------------------------------
  // 6. Resolve or create the IdentityTrack, set the track cookie
  //    - Linked to accountId when authenticated, null when anonymous
  // -------------------------------------------------------------------------
  await resolveCookies(isAuthenticated ? (accountId || null) : null);

  // Read the track cookie that resolveCookies just set
  const cookieStore = await cookies();
  const trackId = cookieStore.get('track')?.value ?? null;

  if (!trackId) {
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // Resolve the IdentityTrack record from the DB using the cookie value
  let track;
  try {
    track = await resolveOrCreateIdentityTrack(trackId, isAuthenticated ? (accountId || null) : null);
  } catch (error) {
    await logError('auth', error, 'whoisthis_resolve_track');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // -------------------------------------------------------------------------
  // 7. Resolve or create the Identity for this (track, app) pair
  //    This always happens — authenticated or not.
  // -------------------------------------------------------------------------
  let identity;
  try {
    identity = await resolveOrCreateIdentity(track.id, appId);
  } catch (error) {
    await logError('auth', error, 'whoisthis_resolve_identity');
    return buildHtmlResponse(
      { type: 'neupid:silent_auth', authenticated: false, reason: 'internal_error' },
      targetOrigin
    );
  }

  // -------------------------------------------------------------------------
  // 8. Sign the identity JWT (always issued, authenticated or not)
  //    details is populated from account data when authenticated, empty otherwise
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 9. If authenticated, also issue a short-lived code for server exchange
  // -------------------------------------------------------------------------
  if (isAuthenticated && accountId && sessionId) {
    const { searchParams } = new URL(request.url);
    const codeChallenge = searchParams.get('codeChallenge') ?? undefined;
    const codeChallengeMethod = searchParams.get('codeChallengeMethod') ?? undefined;

    try {
      const { code } = await issueSilentAuthCode(
        accountId,
        track.id,
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
      // Fall through — still return the JWT without a code
      return buildHtmlResponse(
        { type: 'neupid:silent_auth', authenticated: true, token },
        targetOrigin
      );
    }
  }

  // -------------------------------------------------------------------------
  // 10. Unauthenticated — return JWT with authenticated: false, no code
  // -------------------------------------------------------------------------
  return buildHtmlResponse(
    { type: 'neupid:silent_auth', authenticated: false, token },
    targetOrigin
  );
}
