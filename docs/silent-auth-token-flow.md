# Silent Auth → Token → Account Info Flow

This document describes the full lifecycle from a third-party app's initial silent
auth request through to retrieving the user's account details via a JWT.

**Base URL:** `https://neupgroup.com/account`

All endpoints below are relative to this base. For example:
`/account/bridge/silent.v1/init` → `https://neupgroup.com/account/bridge/silent.v1/init`

---

## Overview

```
Third-party app                        neupgroup.com/account
      │                                          │
      │  1. iframe /account/bridge/silent.v1/init│
      │────────────────────────────────────────▶│  validate origin, create guest cookie
      │◀────────────────────────────────────────│  postMessage { ok: true }
      │                                          │
      │  2. iframe /account/bridge/silent.v1/auth/whoisthis
      │────────────────────────────────────────▶│  validate session, create ApplicationConnection
      │◀────────────────────────────────────────│  postMessage { authenticated, token, code? }
      │                                          │
      │  3. POST /account/bridge/silent.v1/auth/exchange  (server-to-server)
      │────────────────────────────────────────▶│  exchange code → { aid, sid, skey, ... }
      │◀────────────────────────────────────────│
      │                                          │
      │  4. POST /account/bridge/api.v1/auth/token
      │────────────────────────────────────────▶│  validate aid+sid+skey, issue JWT
      │◀────────────────────────────────────────│  { token, exp }
      │                                          │
      │  5. POST /account/bridge/api.v1/me       │
      │  Authorization: Bearer <token>           │
      │────────────────────────────────────────▶│  verify JWT, re-validate session
      │◀────────────────────────────────────────│  { account, brandAccounts, accessibleAccounts }
```

---

## Step 1 — Initialize the silent session

Load an invisible iframe pointing to the init endpoint. This creates the guest
cookie that anchors the device identity.

```html
<iframe
  src="https://neupgroup.com/account/bridge/silent.v1/init"
  style="display:none"
  id="neup-init"
></iframe>
```

Listen for the postMessage response:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://neupgroup.com') return;
  if (event.data?.type === 'neupid:silent_init' && event.data.ok) {
    // Proceed to step 2
  }
});
```

**Prerequisite**: Your app's origin must be registered as a `silentSsoOrigin`
in `ApplicationBridge` for your `appId`.

---

## Step 2 — Silent auth check (whoisthis)

Load a second iframe to check whether the user is already logged in.
Pass a PKCE code challenge if you want to exchange the code server-side.

```js
// Generate PKCE pair
const codeVerifier = generateRandomBase64url(64);
const codeChallenge = await sha256Base64url(codeVerifier);

const url = new URL('https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis');
url.searchParams.set('codeChallenge', codeChallenge);
url.searchParams.set('codeChallengeMethod', 'S256');

const iframe = document.createElement('iframe');
iframe.src = url.toString();
iframe.style.display = 'none';
document.body.appendChild(iframe);
```

Listen for the response:

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://neupgroup.com') return;
  const { type, authenticated, token, code } = event.data ?? {};
  if (type !== 'neupid:silent_auth') return;

  if (authenticated && code) {
    // User is logged in — exchange the code server-side (step 3)
    exchangeCode(code, codeVerifier);
  } else {
    // User is not logged in — show your login UI
  }
});
```

**What happens on the server during this step:**
- The user's session cookies are validated against the database.
- If valid, an `ApplicationConnection` record is created (or confirmed) for
  `(accountId, appId)` — the app now appears in the user's connected-apps list.
- A short-lived `silent_auth_code` is stored in `AuthnRequest` (TTL: 5 minutes).
- A signed identity JWT (`ssid`) is returned via postMessage.

---

## Step 3 — Exchange the code (server-to-server)

Your **backend** calls this endpoint. Never call it from the browser.

```http
POST https://neupgroup.com/account/bridge/silent.v1/auth/exchange
Content-Type: application/json

{
  "appId":        "your-app-id",
  "appSecret":    "your-app-secret",
  "code":         "<code from postMessage>",
  "codeVerifier": "<codeVerifier from step 2>"
}
```

**Response (200):**
```json
{
  "success":      true,
  "accountId":    "uuid",
  "neupId":       "username",
  "displayName":  "Jane Smith",
  "displayImage": "https://...",
  "accountType":  "individual",
  "verified":     true
}
```

You now have the user's `accountId`. To get the full account details including
brand accounts and accessible accounts, proceed to steps 4 and 5.

---

## Step 4 — Issue an account JWT

Use the `aid`, `sid`, `skey` values. These come from:
- The session cookies on a first-party page (read server-side), **or**
- A prior call to `/account/bridge/api.v1/auth/grant` for external app sessions.

```http
POST https://neupgroup.com/account/bridge/api.v1/auth/token
Content-Type: application/json

{
  "aid":   "<account ID>",
  "sid":   "<session ID>",
  "skey":  "<session key>",
  "appId": "your-app-id"
}
```

**What the server does:**
1. Looks up `AuthnSession` by `sid` and verifies `accountId === aid` and `key === skey` and `validTill > now`.
2. Upserts an `ApplicationConnection` for `(aid, appId)`.
3. Signs a JWT (HS256) with `Application.appSecret`:
   ```json
   { "aid": "...", "sid": "...", "skey": "...", "appId": "...", "iat": 0, "exp": 0 }
   ```

**Response (200):**
```json
{
  "success": true,
  "token":   "<signed JWT>",
  "exp":     1748000000
}
```

**Error responses:**

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | `invalid_request` | Missing aid, sid, skey, or appId |
| 401 | `invalid_session` | Session not found, expired, or credentials mismatch |
| 404 | `app_not_found` | Application not found or has no appSecret |
| 500 | `internal_server_error` | Unexpected error |

**Token lifetime:** 7 days. Re-issue by calling this endpoint again with fresh
session credentials.

---

## Step 5 — Get account info

Pass the JWT as a Bearer token. The server verifies the signature **and**
re-validates the embedded session against the database on every request.

```http
POST https://neupgroup.com/account/bridge/api.v1/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "account": {
    "id":           "uuid",
    "neupId":       "username",
    "displayName":  "Jane Smith",
    "displayImage": "https://...",
    "accountType":  "individual",
    "verified":     true,
    "status":       "active"
  },
  "brandAccounts": [
    {
      "id":           "uuid",
      "displayName":  "Acme Corp",
      "displayImage": null,
      "status":       "active",
      "isVerified":   true,
      "accountType":  "brand",
      "capabilities": ["brand.manage", "brand.publish"]
    }
  ],
  "accessibleAccounts": [
    {
      "id":           "uuid",
      "displayName":  "Acme Corp",
      "displayImage": null,
      "status":       "active",
      "isVerified":   true,
      "accountType":  "brand",
      "capabilities": ["brand.manage", "brand.publish"]
    },
    {
      "id":           "uuid",
      "displayName":  "Acme Branch NYC",
      "displayImage": null,
      "status":       "active",
      "isVerified":   false,
      "accountType":  "branch",
      "capabilities": ["branch.view"]
    }
  ]
}
```

**Fields:**

| Field | Description |
|-------|-------------|
| `account` | The logged-in user's own profile |
| `brandAccounts` | Brand and branch accounts the user has been granted access to |
| `accessibleAccounts` | All accounts the user can act on (includes brands, branches, dependents, delegated) |
| `capabilities` | The specific capabilities the user holds on each account |

**Error responses:**

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | `missing_token` | No Authorization header |
| 401 | `invalid_token` | JWT signature invalid or malformed |
| 401 | `token_expired` | JWT has expired — re-issue via /account/bridge/api.v1/auth/token |
| 401 | `session_invalid` | Session was revoked after token was issued |
| 401 | `account_not_found` | Account no longer exists |
| 403 | `account_blocked` | Account is currently blocked |
| 500 | `internal_server_error` | Unexpected error |

---

## Security notes

- **appSecret is never exposed to the browser.** Token issuance and verification
  happen server-to-server only.
- **Session re-validation on every /me call.** Even if a JWT is valid, if the
  underlying session has been revoked (logout, admin action), the request is
  rejected with `session_invalid`.
- **PKCE protects the code exchange.** The `codeChallenge` / `codeVerifier` pair
  ensures only the party that initiated the silent auth can exchange the code.
- **Origin validation.** The `whoisthis` iframe only responds to origins
  registered in `ApplicationBridge` with `type: 'silentSsoOrigin'`.
- **ApplicationConnection is created automatically.** As soon as a user
  successfully completes silent auth, the connection is recorded — no separate
  "connect" step is needed.

---

## Quick reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `https://neupgroup.com/account/bridge/silent.v1/init` | GET (iframe) | none | Initialize guest cookie |
| `https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis` | GET (iframe) | session cookie | Check auth, get code |
| `https://neupgroup.com/account/bridge/silent.v1/auth/exchange` | POST (server) | appId + appSecret | Exchange code for identity |
| `https://neupgroup.com/account/bridge/api.v1/auth/token` | POST (server) | aid + sid + skey | Issue account JWT |
| `https://neupgroup.com/account/bridge/api.v1/me` | POST (server) | Bearer JWT | Get full account info |
