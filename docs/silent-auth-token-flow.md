# Silent Auth → Token → Account Info Flow

This document describes the full lifecycle from a third-party app's silent
auth request through to retrieving the user's account details.

**Base URL:** `https://neupgroup.com/account`

All endpoints below are relative to this base. For example:
`/account/bridge/silent.v1/whoisthis` → `https://neupgroup.com/account/bridge/silent.v1/whoisthis`

---

## Overview

```
Third-party app                        neupgroup.com/account
      │                                          │
      │  1. iframe /account/bridge/silent.v1/whoisthis?app=[id]
      │────────────────────────────────────────▶│  init guest if needed, validate session
      │◀────────────────────────────────────────│  postMessage { success, token, response }
      │                                          │
      │  (token expired? reload the iframe — step 1 again)
      │                                          │
      │  2. POST /account/bridge/api.v1/accounts/lookup  (optional, server-to-server)
      │────────────────────────────────────────▶│  public profile lookup
      │◀────────────────────────────────────────│  { account }
```

---

## Step 1 — Silent auth check (whoisthis)

This is the **only iframe** your app needs to load. It handles everything:
- Initializes the guest cookie if none exists
- Validates the user's session
- Returns a signed JWT and account info in a single postMessage

When the JWT expires, simply reload the iframe to get a fresh one.

```js
const iframe = document.createElement('iframe');
iframe.src = 'https://neupgroup.com/account/bridge/silent.v1/whoisthis?app=YOUR_APP_ID';
iframe.style.display = 'none';
document.body.appendChild(iframe);

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://neupgroup.com') return;
  const { type, success, token, response } = event.data ?? {};
  if (type !== 'neupid:silent_auth') return;

  if (success) {
    // User is authenticated
    // token.cid  — stable connection ID (always present)
    // token.aid  — account ID (only present for party 1 or 2 apps)
    // token.iat  — issued-at Unix timestamp
    // token.exp  — expiry Unix timestamp
    // response   — flat map of account info (name.display, contact.email, etc.)
    console.log('Authenticated:', token, response);
  } else {
    // Guest / not logged in
    console.log('Not authenticated');
  }
});
```

**Prerequisite**: Your app's origin must be registered as a `silentSsoOrigin`
in `ApplicationBridge` for your `appId`.

**What happens on the server:**
- Guest cookie is initialized if it doesn't exist yet.
- Session cookies are validated against the database.
- If valid, an `ApplicationConnection` is created (or confirmed) for `(accountId, appId)`.
- A signed JWT is always returned — even for unauthenticated/guest users.

---

## Token shape

The JWT is signed with `Application.appSecret` (HS256). Its decoded payload
is also returned directly in the `token` field of the postMessage so you
don't need to decode it yourself.

### Party 1 or 2 (first-party / trusted apps)

```json
{
  "cid": "<ApplicationConnection.id>",
  "aid": "<account UUID>",
  "iat": 1748000000,
  "exp": 1748604800
}
```

### Party 3 or 4 (third-party apps)

```json
{
  "cid": "<ApplicationConnection.id>",
  "iat": 1748000000,
  "exp": 1748604800
}
```

`cid` is the stable identifier for the link between this account and your app.
`aid` is only included when `Application.party` is `1` or `2`.

**Token lifetime:** 7 days. Re-issue by reloading the iframe.

---

## Response shape

The `response` field in the postMessage is a flat key→value map of the
authenticated user's account info. It is an empty object `{}` when the user
is not authenticated.

```json
{
  "name.display":     "Jane Smith",
  "name.first":       "Jane",
  "name.last":        "Smith",
  "account.type":     "individual",
  "account.verified": "true",
  "contact.email":    "jane@example.com",
  "contact.phone":    "+1234567890"
}
```

---

## Full postMessage payload

```json
{
  "type":     "neupid:silent_auth",
  "success":  true,
  "token": {
    "cid": "<ApplicationConnection.id>",
    "aid": "<account UUID>",
    "iat": 1748000000,
    "exp": 1748604800
  },
  "response": {
    "name.display":     "Jane Smith",
    "account.type":     "individual",
    "account.verified": "true",
    "contact.email":    "jane@example.com"
  }
}
```

When unauthenticated:

```json
{
  "type":     "neupid:silent_auth",
  "success":  false,
  "token": {
    "cid": "<identity.id>",
    "iat": 1748000000,
    "exp": 1748604800
  },
  "response": {}
}
```

---

## Step 2 — Look up account info (optional, server-to-server)

If you need richer account data beyond what `response` provides, use the
lookup endpoint from your backend.

```http
GET https://neupgroup.com/account/bridge/api.v1/accounts/lookup
  ?appId=your-app-id
  &appSecret=your-app-secret
  &accountId=<uuid>
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

---

## Application party values

| `party` | Meaning | `aid` in token |
|---------|---------|----------------|
| `1` | First-party (internal) | ✅ included |
| `2` | Trusted partner | ✅ included |
| `3` | Third-party app | ❌ omitted |
| `4` | Public / anonymous app | ❌ omitted |

---

## Security notes

- **appSecret is never exposed to the browser.** The JWT is signed server-side.
- **Origin validation.** `whoisthis` only responds to origins registered in `ApplicationBridge` with `type: 'silentSsoOrigin'`.
- **ApplicationConnection is created automatically** on the first successful silent auth.
- **Init is automatic.** Guest cookie initialization happens inside `whoisthis` — no separate iframe needed.
- **Token expiry.** When `token.exp` is in the past, reload the iframe to get a fresh token.

---

## Quick reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bridge/silent.v1/whoisthis?app=[id]` | GET (iframe) | Init guest + check auth, get token + account info |
| `/bridge/silent.v1/auth/exchange` | POST (server) | Exchange silent auth code for identity (legacy PKCE flow) |
| `/bridge/api.v1/accounts/lookup` | GET (server) | Public profile by accountId or neupId |
| `/bridge/api.v1/application/users` | GET (server) | All connected users for your app |
| `/bridge/api.v1/application/roles` | GET (server) | Roles defined for your app |
| `/bridge/api.v1/application/access` | GET (server) | Access grants for your app |
