# Silent SSO Integration Guide

This guide explains how to integrate NeupID Silent SSO into your application. Silent SSO lets you authenticate users without a visible redirect — if the user already has an active NeupID session, your app gets a signed identity token silently via a hidden iframe.

---

## How it works

```
Your App                    NeupID Auth Server
   |                              |
   |-- hidden iframe load ------> GET /bridge/silent.v1/auth/whoisthis
   |                              |-- checks session cookie
   |                              |-- validates your origin
   |                              |-- issues JWT + auth code
   | <-- postMessage(token) ------| 
   |
   |-- your backend -----------> POST /bridge/silent.v1/auth/exchange
   |                              |-- validates appId + appSecret + code
   | <-- { accountId, neupId } --|
```

The iframe endpoint always returns HTTP 200. Success or failure is communicated through the `postMessage` payload — this ensures the iframe always loads even when the user isn't signed in.

---

## Prerequisites

Before you can use Silent SSO:

1. You have a registered application in NeupID with an `appId` and `appSecret`
2. Your application's domain is registered as a `silentSsoOrigin` (see [Registering your origin](#registering-your-origin))
3. Your app is served over HTTPS

---

## Registering your origin

Go to your application's detail page in the NeupID dashboard:

```
/data/applications/{your-app-id}
```

Scroll to the **Silent SSO Origins** card and click **Manage Origins**. Add your domain — for example `https://tourio.com`. Only the scheme and host matter; paths are ignored.

You can register multiple origins for the same application (e.g. `https://app.tourio.com` and `https://tourio.com`).

> Origins must use HTTPS. HTTP origins are rejected.

---

## Step 1 — Embed the hidden iframe

On any page where you want to silently check authentication, embed the iframe:

```html
<iframe
  src="https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis?appId=YOUR_APP_ID"
  style="display:none;width:0;height:0;border:0"
  id="neupid-sso-frame"
></iframe>
```

Or with PKCE (recommended):

```html
<iframe
  src="https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis?appId=YOUR_APP_ID&codeChallenge=BASE64URL_SHA256_OF_VERIFIER&codeChallengeMethod=S256"
  style="display:none;width:0;height:0;border:0"
  id="neupid-sso-frame"
></iframe>
```

---

## Step 2 — Listen for the postMessage

Add a message listener **before** the iframe loads. Always validate `event.origin` before processing.

```javascript
const NEUPID_ORIGIN = 'https://neupgroup.com';
const TIMEOUT_MS = 10_000; // 10 seconds

let ssoTimeout;

function initSilentSSO(appId) {
  ssoTimeout = setTimeout(() => {
    // Iframe didn't respond in time — fall back to redirect
    handleSilentSSOResult({ authenticated: false, reason: 'timeout' });
  }, TIMEOUT_MS);

  window.addEventListener('message', onSSOMessage);
}

function onSSOMessage(event) {
  // Always validate the sender origin
  if (event.origin !== NEUPID_ORIGIN) return;

  const payload = event.data;

  // Only handle NeupID silent auth messages
  if (!payload || payload.type !== 'neupid:silent_auth') return;

  clearTimeout(ssoTimeout);
  window.removeEventListener('message', onSSOMessage);

  // Remove the iframe
  const frame = document.getElementById('neupid-sso-frame');
  if (frame) frame.remove();

  handleSilentSSOResult(payload);
}

function handleSilentSSOResult(payload) {
  if (payload.authenticated) {
    // Option A: use the JWT directly (lightweight, no server call)
    const identity = parseNeupIDToken(payload.token);
    console.log('Signed in as ssid:', identity.ssid);

    // Option B: exchange the code server-side for full identity
    exchangeCode(payload.code);
  } else {
    // Fall back to the redirect-based handshake
    const reason = payload.reason; // 'no_session' | 'session_invalid' | 'origin_not_registered' | 'rate_limited' | 'timeout'
    console.log('Silent auth failed:', reason);
    redirectToNeupID();
  }
}

function redirectToNeupID() {
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href =
    `https://neupgroup.com/account/bridge/handshake.v1/auth/grant` +
    `?appId=YOUR_APP_ID&authenticatesTo=${returnUrl}`;
}
```

---

## Step 3 — Parse the JWT (client-side, optional)

The JWT is signed with your `appSecret` using HS256. On the client side you can decode it (without verifying the signature) to read the identity fields:

```javascript
function parseNeupIDToken(token) {
  // Decode without verification — verification happens server-side
  const [, payloadB64] = token.split('.');
  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

  return {
    ssid: payload.ssid,           // stable site-scoped identity ID
    sid: payload.sid,             // session ID (null if unauthenticated)
    originatedOn: payload.originated_on,
    refreshesOn: payload.refreshes_on,
    expiresOn: payload.expires_on,
  };
}
```

**JWT payload fields:**

| Field | Type | Description |
|---|---|---|
| `ssid` | `string` | Stable, site-scoped identity ID. Consistent across sessions for the same user + app pair. |
| `sid` | `string \| null` | Session ID. `null` if the user has no active session. |
| `originated_on` | ISO 8601 string | When this identity was first created. |
| `refreshes_on` | ISO 8601 string | When the identity token should be refreshed (1 hour from issuance). |
| `expires_on` | ISO 8601 string | When the identity expires (4 weeks from `originated_on`). |

> The JWT has no `exp` claim. Use `expires_on` from the payload to check expiry.

**Verify the signature server-side** using your `appSecret`:

```javascript
// Node.js / server-side
import jwt from 'jsonwebtoken';

const payload = jwt.verify(token, process.env.NEUPID_APP_SECRET, { algorithms: ['HS256'] });
```

---

## Step 4 — Exchange the code server-side (optional, for full identity)

The JWT only contains opaque identity fields. If you need the user's name, neupId, or verified status, exchange the `code` from the postMessage payload on your backend:

```
POST https://neupgroup.com/account/bridge/silent.v1/auth/exchange
Content-Type: application/json

{
  "appId": "YOUR_APP_ID",
  "appSecret": "YOUR_APP_SECRET",
  "code": "CODE_FROM_POSTMESSAGE"
}
```

**This must be called from your server, not from the browser.** The endpoint rejects requests that include a browser `Origin` header matching your registered domain.

**Success response (200):**

```json
{
  "success": true,
  "accountId": "uuid",
  "neupId": "neupid_handle_or_null",
  "displayName": "Jane Smith",
  "displayImage": "https://...",
  "accountType": "individual",
  "verified": true
}
```

**Error responses:**

| Status | `error` | Meaning |
|---|---|---|
| 400 | `invalid_code` | Code is expired, already used, or doesn't exist |
| 400 | `app_mismatch` | Code was issued for a different `appId` |
| 400 | `invalid_code_verifier` | PKCE verification failed |
| 400 | `invalid_request` | Missing required fields |
| 401 | `unauthorized` | Wrong `appSecret` |
| 403 | `browser_origin_forbidden` | Request came from a browser (not a server) |

**Example (Node.js):**

```javascript
async function exchangeNeupIDCode(code) {
  const response = await fetch(
    'https://neupgroup.com/account/bridge/silent.v1/auth/exchange',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: process.env.NEUPID_APP_ID,
        appSecret: process.env.NEUPID_APP_SECRET,
        code,
      }),
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(`NeupID exchange failed: ${data.error}`);
  }

  return data; // { accountId, neupId, displayName, displayImage, accountType, verified }
}
```

---

## Using PKCE (recommended)

PKCE prevents authorization code interception. Generate a verifier and challenge before loading the iframe:

```javascript
async function generatePKCE() {
  // Generate a random verifier
  const array = new Uint8Array(48);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Hash it to get the challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const challenge = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return { verifier, challenge };
}

// Usage
const { verifier, challenge } = await generatePKCE();

// Store verifier securely (sessionStorage is fine for this)
sessionStorage.setItem('neupid_pkce_verifier', verifier);

// Load iframe with challenge
const iframe = document.createElement('iframe');
iframe.src = `https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis` +
  `?appId=YOUR_APP_ID&codeChallenge=${challenge}&codeChallengeMethod=S256`;
iframe.style.display = 'none';
document.body.appendChild(iframe);
```

Then include the verifier in the exchange request:

```javascript
const verifier = sessionStorage.getItem('neupid_pkce_verifier');

const response = await fetch('.../exchange', {
  method: 'POST',
  body: JSON.stringify({
    appId: process.env.NEUPID_APP_ID,
    appSecret: process.env.NEUPID_APP_SECRET,
    code,
    codeVerifier: verifier,
  }),
});
```

---

## Complete example

Here's a minimal end-to-end implementation:

```javascript
// neupid-sso.js

const NEUPID_ORIGIN = 'https://neupgroup.com';
const NEUPID_BASE = 'https://neupgroup.com/account';
const APP_ID = 'YOUR_APP_ID';
const TIMEOUT_MS = 10_000;

export function initSilentSSO({ onAuthenticated, onUnauthenticated }) {
  let timeout;

  function cleanup() {
    clearTimeout(timeout);
    window.removeEventListener('message', onMessage);
    document.getElementById('neupid-sso-frame')?.remove();
  }

  function onMessage(event) {
    if (event.origin !== NEUPID_ORIGIN) return;
    const payload = event.data;
    if (!payload || payload.type !== 'neupid:silent_auth') return;

    cleanup();

    if (payload.authenticated) {
      onAuthenticated({ token: payload.token, code: payload.code });
    } else {
      onUnauthenticated(payload.reason);
    }
  }

  timeout = setTimeout(() => {
    cleanup();
    onUnauthenticated('timeout');
  }, TIMEOUT_MS);

  window.addEventListener('message', onMessage);

  const iframe = document.createElement('iframe');
  iframe.id = 'neupid-sso-frame';
  iframe.src = `${NEUPID_BASE}/bridge/silent.v1/auth/whoisthis?appId=${APP_ID}`;
  iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute';
  document.body.appendChild(iframe);
}

export function redirectToLogin(returnUrl = window.location.href) {
  window.location.href =
    `${NEUPID_BASE}/bridge/handshake.v1/auth/grant` +
    `?appId=${APP_ID}&authenticatesTo=${encodeURIComponent(returnUrl)}`;
}
```

```javascript
// In your app's auth initialization
import { initSilentSSO, redirectToLogin } from './neupid-sso';

initSilentSSO({
  onAuthenticated: async ({ token, code }) => {
    // Send code to your backend to establish a session
    const res = await fetch('/api/auth/neupid-callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      // User is now signed in — update your UI
      const user = await res.json();
      setCurrentUser(user);
    }
  },
  onUnauthenticated: (reason) => {
    if (reason === 'no_session' || reason === 'timeout') {
      // User isn't signed in to NeupID — redirect to login
      redirectToLogin();
    }
    // For 'origin_not_registered' or 'rate_limited', handle accordingly
  },
});
```

```javascript
// /api/auth/neupid-callback (your backend)
app.post('/api/auth/neupid-callback', async (req, res) => {
  const { code } = req.body;

  const response = await fetch(
    'https://neupgroup.com/account/bridge/silent.v1/auth/exchange',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: process.env.NEUPID_APP_ID,
        appSecret: process.env.NEUPID_APP_SECRET,
        code,
      }),
    }
  );

  const identity = await response.json();

  if (!identity.success) {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  // Create your own session for this user
  req.session.userId = identity.accountId;
  req.session.neupId = identity.neupId;

  res.json({ accountId: identity.accountId, displayName: identity.displayName });
});
```

---

## Browser compatibility

| Browser | Behavior |
|---|---|
| Chrome, Edge | Silent iframe auth works when the user has a NeupID session |
| Firefox (default) | Works |
| Firefox (strict mode) | Third-party cookies blocked → `no_session` → fallback redirect |
| Safari 17+ | Third-party cookies blocked → `no_session` → fallback redirect |
| Brave (shields up) | Third-party cookies blocked → `no_session` → fallback redirect |

The fallback redirect (`/bridge/handshake.v1/auth/grant`) works on all browsers. When the user already has a NeupID session, the auth server redirects back to your app immediately — the user sees a brief flash at most.

**The 10-second timeout handles the case where the iframe never fires a message** (e.g. network error, browser blocking the iframe entirely). After the timeout, treat it as `no_session` and redirect.

---

## Security notes

- **Never call the `/exchange` endpoint from the browser.** It's server-to-server only. The endpoint rejects requests with a browser `Origin` header.
- **Always validate `event.origin`** in your `message` listener. Only accept messages from `https://neupgroup.com`.
- **The JWT contains no PII.** `ssid` and `sid` are opaque identifiers. Use the `/exchange` endpoint to get the user's name, neupId, etc.
- **Codes expire in 5 minutes** and are single-use. Exchange them immediately.
- **The `ssid` is stable** — the same user visiting the same app always gets the same `ssid`. You can use it as a stable identifier without calling `/exchange` every time.
- **Keep your `appSecret` server-side only.** Never expose it in client-side code or commit it to source control.

---

## Troubleshooting

**`origin_not_registered`** — Your domain isn't registered as a `silentSsoOrigin` for this app. Go to the NeupID dashboard → your application → Silent SSO Origins → add your domain.

**`no_session`** — The user doesn't have an active NeupID session, or their browser is blocking third-party cookies. Redirect to the handshake flow.

**`session_invalid`** — The session cookie exists but the session has expired or been invalidated. Redirect to the handshake flow.

**`rate_limited`** — More than 10 iframe loads from your origin in the last minute. This is unusual in normal usage — check for accidental loops in your code.

**`invalid_code` on exchange** — The code expired (5-minute window), was already used, or the `appId` doesn't match. Don't retry with the same code — redirect to the handshake flow to get a fresh one.

**`browser_origin_forbidden` on exchange** — You're calling `/exchange` from the browser. Move this call to your server.

**Iframe never fires a message** — The 10-second timeout will trigger. Check that your domain is registered, that you're on HTTPS, and that the iframe URL is correct.
