# Silent Auth → Token → Account Info Flow

This document describes the full lifecycle from a third-party app's initial silent
auth request through to retrieving the user's account details.

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
      │────────────────────────────────────────▶│  exchange code → { accountId, neupId, ... }
      │◀────────────────────────────────────────│
      │                                          │
      │  4. POST /account/bridge/api.v1/auth/token
      │────────────────────────────────────────▶│  validate aid+sid+skey, issue JWT { cid, iat, exp }
      │◀────────────────────────────────────────│  { token, exp }
      │                                          │
      │  5. GET /account/bridge/api.v1/accounts/lookup?accountId=...
      │────────────────────────────────────────▶│  public profile lookup
      │◀────────────────────────────────────────│  { account }
      │                                          │
      │  6. GET /account/bridge/api.v1/accounts  │  (optional)
      │────────────────────────────────────────▶│  all accessible accounts + capabilities
      │◀────────────────────────────────────────│  { accounts }
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
    exchangeCode(code, codeVerifier); // step 3 — server-side
  } else {
    // not logged in — show your login UI
  }
});
```

**What happens on the server:**
- Session cookies are validated against the database.
- If valid, an `ApplicationConnection` is created (or confirmed) for `(accountId, appId)`.
- A short-lived `silent_auth_code` is stored in `AuthnRequest` (TTL: 5 minutes).

---

## Step 3 — Exchange the code (server-to-server)

Your **backend** calls this. Never call it from the browser.

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

---

## Step 4 — Issue an account JWT

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
1. Validates `aid`/`sid`/`skey` against `AuthnSession` in the database.
2. Upserts an `ApplicationConnection` for `(aid, appId)` and gets its `id`.
3. Signs a JWT (HS256, using `Application.appSecret`) with only:

```json
{
  "cid": "<ApplicationConnection.id>",
  "iat": 1748000000,
  "exp": 1748604800
}
```

`cid` is the stable identifier for the link between this account and your app.
The JWT contains no account data.

**Response (200):**
```json
{
  "success": true,
  "token":   "<signed JWT>",
  "exp":     1748604800
}
```

**Error responses:**

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | `invalid_request` | Missing aid, sid, skey, or appId |
| 401 | `invalid_session` | Session not found, expired, or credentials mismatch |
| 404 | `app_not_found` | Application not found or has no appSecret |
| 500 | `internal_server_error` | Unexpected error |

**Token lifetime:** 7 days. Re-issue by calling this endpoint again.

---

## Step 5 — Look up account info

Use the `accountId` from step 3 to fetch the public profile.

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/lookup?accountId=<uuid>
```

Or look up by NeupID handle:

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/lookup?neupId=<handle>
```

**Response (200):**
```json
{
  "success": true,
  "account": {
    "accountId":    "uuid",
    "displayName":  "Jane Smith",
    "displayImage": "https://...",
    "accountType":  "individual",
    "neupId":       "janesmith"
  }
}
```

**Error responses:**

| Status | Meaning |
|--------|---------|
| 400 | Neither `accountId` nor `neupId` provided |
| 404 | Account not found |

---

## Step 6 — Get accessible accounts (optional)

Returns all accounts the user has been granted access to (brand, branch,
dependent, delegated), each with the capabilities the user holds on it.

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts
```

For brand/branch accounts only:

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/brands
```

Both endpoints read the session from cookies (first-party) or require the
user to be authenticated via the standard session flow.

**Response (200):**
```json
{
  "success": true,
  "accounts": [
    {
      "id":           "uuid",
      "displayName":  "Acme Corp",
      "displayImage": null,
      "status":       "active",
      "isVerified":   true,
      "accountType":  "brand",
      "capabilities": ["brand.manage", "brand.publish"]
    }
  ]
}
```

---

## Security notes

- **The JWT contains no account data.** Only `cid`, `iat`, and `exp`.
- **appSecret is never exposed to the browser.** Token issuance happens server-to-server only.
- **PKCE protects the code exchange.** Only the party that initiated silent auth can exchange the code.
- **Origin validation.** The `whoisthis` iframe only responds to origins registered in `ApplicationBridge` with `type: 'silentSsoOrigin'`.
- **ApplicationConnection is created automatically** on the first successful silent auth.

---

## Quick reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://neupgroup.com/account/bridge/silent.v1/init` | GET (iframe) | Initialize guest cookie |
| `https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis` | GET (iframe) | Check auth, get code |
| `https://neupgroup.com/account/bridge/silent.v1/auth/exchange` | POST (server) | Exchange code for identity |
| `https://neupgroup.com/account/bridge/api.v1/auth/token` | POST (server) | Issue JWT `{ cid, iat, exp }` |
| `https://neupgroup.com/account/bridge/api.v1/accounts/lookup` | GET | Public profile by accountId or neupId |
| `https://neupgroup.com/account/bridge/api.v1/accounts` | GET | All accessible accounts + capabilities |
| `https://neupgroup.com/account/bridge/api.v1/accounts/brands` | GET | Brand/branch accounts + capabilities |
