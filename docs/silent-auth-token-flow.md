# Silent Auth → Token → Account Info Flow

This document describes the full lifecycle from a third-party app's silent
auth request through to retrieving the user's account details.

**Base URL:** `https://neupgroup.com/account`

All endpoints below are relative to this base. For example:
`/account/bridge/silent.v1/auth/whoisthis` → `https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis`

---

## Overview

```
Third-party app                        neupgroup.com/account
      │                                          │
      │  1. iframe /account/bridge/silent.v1/auth/whoisthis
      │────────────────────────────────────────▶│  init guest if needed, validate session
      │◀────────────────────────────────────────│  postMessage { authenticated, token, code? }
      │                                          │
      │  2. POST /account/bridge/silent.v1/auth/exchange  (server-to-server)
      │────────────────────────────────────────▶│  exchange code → { accountId, neupId, ... }
      │◀────────────────────────────────────────│
      │                                          │
      │  3. POST /account/bridge/api.v1/auth/token
      │────────────────────────────────────────▶│  validate aid+sid+skey, issue JWT { cid, iat, exp }
      │◀────────────────────────────────────────│  { token, exp }
      │                                          │
      │  4. GET /account/bridge/api.v1/accounts/lookup?accountId=...
      │────────────────────────────────────────▶│  public profile lookup
      │◀────────────────────────────────────────│  { account }
      │                                          │
      │  5. GET /account/bridge/api.v1/accounts  │  (optional)
      │────────────────────────────────────────▶│  all accessible accounts + capabilities
      │◀────────────────────────────────────────│  { accounts }
```

---

## Step 1 — Silent auth check (whoisthis)

This is the **only iframe** your app needs to load. It handles initialization
automatically — if no guest cookie exists it creates one, then checks whether
the user is logged in and responds accordingly.

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
    exchangeCode(code, codeVerifier); // step 2 — server-side
  } else {
    // guest / not logged in — token still present for anonymous identity
  }
});
```

**Prerequisite**: Your app's origin must be registered as a `silentSsoOrigin`
in `ApplicationBridge` for your `appId`.

**What happens on the server:**
- Guest cookie is initialized if it doesn't exist yet.
- Session cookies are validated against the database.
- If valid, an `ApplicationConnection` is created (or confirmed) for `(accountId, appId)`.
- A short-lived `silent_auth_code` is stored in `AuthnRequest` (TTL: 5 minutes).
- A signed JWT is always returned — even for unauthenticated/guest users.

---

## Step 2 — Exchange the code (server-to-server)

Your **backend** calls this. Never call it from the browser.

```http
POST https://neupgroup.com/account/bridge/silent.v1/auth/exchange
Content-Type: application/json

{
  "appId":        "your-app-id",
  "appSecret":    "your-app-secret",
  "code":         "<code from postMessage>",
  "codeVerifier": "<codeVerifier from step 1>"
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

## Step 3 — Issue an account JWT

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

## Step 4 — Look up account info

The lookup endpoint requires valid app credentials (`appId` + `appSecret`).
On a successful lookup, an `ApplicationConnection` is automatically created
between the looked-up account and your app.

Look up by account UUID:

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/lookup?appId=your-app-id&appSecret=your-app-secret&accountId=<uuid>
```

Or by NeupID handle:

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/lookup?appId=your-app-id&appSecret=your-app-secret&neupId=<handle>
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
| 400 | Missing `appId`, `appSecret`, or both `accountId` and `neupId` |
| 401 | Invalid app credentials |
| 404 | Account not found |
| 500 | Internal server error |

---

## Step 5 — Get accessible accounts (optional)

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
- **Init is automatic.** Guest cookie initialization happens inside `whoisthis` — no separate iframe needed.

---

## Quick reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://neupgroup.com/account/bridge/silent.v1/auth/whoisthis` | GET (iframe) | Init guest if needed + check auth, get token + code |
| `https://neupgroup.com/account/bridge/silent.v1/auth/exchange` | POST (server) | Exchange code for identity |
| `https://neupgroup.com/account/bridge/api.v1/auth/token` | POST (server) | Issue JWT `{ cid, iat, exp }` |
| `https://neupgroup.com/account/bridge/api.v1/accounts/lookup` | GET | Public profile by accountId or neupId |
| `https://neupgroup.com/account/bridge/api.v1/accounts` | GET | All accessible accounts + capabilities |
| `https://neupgroup.com/account/bridge/api.v1/accounts/brands` | GET | Brand/branch accounts + capabilities |
