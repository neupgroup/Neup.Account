import { NextRequest } from 'next/server';
import { validateSilentSsoOrigin } from '@/services/auth/silent-sso';
import { resolveGuestAccount } from '@/services/auth/guestAccount';
import { getSessionCookies } from '@/core/helpers/cookies';

export const dynamic = 'force-dynamic';

/**
 * Builds an HTML page that fires window.parent.postMessage with the given
 * payload and then closes itself. This is the only communication channel
 * for silent.v1 — no JSON responses, only postMessage.
 */
function buildPostMessageResponse(payload: object, targetOrigin: string): Response {
  const payloadJson = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="payload" data-payload="${payloadJson.replace(/"/g, '&quot;')}"></div>
<script>
(function () {
  try {
    var el = document.getElementById('payload');
    var payload = JSON.parse(el.getAttribute('data-payload'));
    window.parent.postMessage(payload, ${JSON.stringify(targetOrigin)});
  } catch (e) {
    window.parent.postMessage(
      { type: 'neupid:silent_init', ok: false, reason: 'internal_error' },
      ${JSON.stringify(targetOrigin)}
    );
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
 * GET /bridge/silent.v1/init
 *
 * Initializes the guest cookie for the calling origin and responds via
 * postMessage. This is the entry point for any third-party app that needs
 * to establish a silent session before calling whoisthis or exchange.
 *
 * Flow:
 *   1. Validate the calling origin against registered silent SSO origins.
 *   2. Resolve (or create) the guest account — writes auth_account cookie.
 *   3. postMessage { type: 'neupid:silent_init', ok: true } back to parent.
 *
 * On any failure, postMessage { type: 'neupid:silent_init', ok: false, reason }.
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

  if (!origin) {
    return buildPostMessageResponse(
      { type: 'neupid:silent_init', ok: false, reason: 'origin_missing' },
      '*'
    );
  }

  const targetOrigin = new URL(origin).origin;

  // 2. Validate origin is a registered silent SSO origin
  const { valid, appId } = await validateSilentSsoOrigin(origin);
  if (!valid || !appId) {
    return buildPostMessageResponse(
      { type: 'neupid:silent_init', ok: false, reason: 'origin_not_registered' },
      targetOrigin
    );
  }

  // 3. Check if already authenticated
  const { accountId } = await getSessionCookies();

  // 4. Initialize the guest cookie (creates guest account if none exists,
  //    links to real account if authenticated)
  try {
    await resolveGuestAccount(accountId || null);
  } catch {
    return buildPostMessageResponse(
      { type: 'neupid:silent_init', ok: false, reason: 'init_failed' },
      targetOrigin
    );
  }

  // 5. Done — postMessage success back to parent frame
  return buildPostMessageResponse(
    { type: 'neupid:silent_init', ok: true, appId },
    targetOrigin
  );
}
