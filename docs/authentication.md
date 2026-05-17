# Authentication for Other Applications

This document explains how other **client applications** (internal apps, partner apps, and third‑party apps) can authenticate users via **Neup.Account**.

If you are building a public integration, use this page to choose the right flow, then follow the linked detailed guides.

**Base URL:** `https://neupgroup.com/account`

---


## Parties

| Party | Typical meaning | Recommended auth flows |
|------:|------------------|------------------------|
| `1` | First‑party internal app | Same‑domain cookies, different‑domain internal verify, Silent SSO |
| `2` | Trusted partner | Different‑domain internal verify, Silent SSO, (optionally) Redirect handshake |
| `3` | Third‑party app built using Neup.Site | Silent SSO (no `aid`) | 
| `4` | Third party custom app | Redirect handshake (only when you need sign‑in for first time sign in and for when there's change in policy), Silent SSO (no `aid`) |

> Note: For Party `3/4`, The account `aid` is omitted not provided to the client application. Use the **redirect handshake** when you are signing in an new user or when the policy for the app is changed.


## Authentication using Redirect Handshake

Use this flow when your application needs to **sign a user in** to your own system by delegating authentication to Neup.Account.

This is the recommended approach for Party `4` apps (and any other public integrations) because it:

- runs the user interaction (login/consent) in the browser via redirect
- returns a short‑lived, one‑time `tempToken` to your callback
- lets your server exchange that `tempToken` for a durable external session (`sid` + `skey`)

### Prerequisites

1. You have an `appId` and `appSecret`.
2. Your callback URL is registered as an `authenticatesTo` URL for your application.
3. Your callback URL must be an absolute HTTPS URL.

### Step 1 — Start the handshake (browser redirect)

Redirect the user’s browser to:

```txt
GET https://neupgroup.com/account/bridge/handshake.v1/auth/grant
  ?appId=YOUR_APP_ID
  &authenticatesTo=https://yourapp.com/auth/callback
```

**Query parameters:**

- `appId` (required): your application id.
- `authenticatesTo` (required): your server callback URL (must be registered).
- Any additional query params are forwarded to your callback unchanged (except `appId` and `authenticatesTo`), so you can include your own `state`, `returnTo`, etc.

### Step 2 — Receive the callback (your server)

On success, Neup.Account redirects back to your callback with:

- `tempToken` (one‑time, valid for ~5 minutes)
- `authType` (`signin` or `signup`)

Example:

```txt
https://yourapp.com/auth/callback?tempToken=TOKEN_VALUE&authType=signin
```

On failure (when Neup.Account can still redirect back to your callback), it includes:

- `error` (an error code)

Example:

```txt
https://yourapp.com/auth/callback?error=invalid_redirect
```

### Step 3 — Exchange `tempToken` for an external session (server‑to‑server POST)

Exchange the token from your backend (never from browser JavaScript):

```http
POST https://neupgroup.com/account/bridge/api.v1/auth/grant
content-type: application/json

{
  "appId": "YOUR_APP_ID",
  "tempToken": "TOKEN_FROM_CALLBACK"
}
```

**Response (200)** includes:

- `aid`: user account id
- `sid` / `skey`: external session credentials (durable for ~7 days)
- `jwt`: short‑lived JWT (about 7 minutes)
- `exp`: JWT expiry (unix seconds)
- `role` and optional `per`

**Common errors:**

- `400 invalid_request` — missing `tempToken` or `appId`
- `401 invalid_token` — token expired, already used, or `appId` mismatch

### Step 4 — Store the external session on your side

Recommended:

- store `aid`, `sid`, and `skey` in your own server session store, or
- store them in your own HTTP‑only cookie scoped to your domain.

Do not expose `appSecret`, `sid`, or `skey` to browser JavaScript.

### Step 5 — Validate an existing external session (server‑to‑server GET)

```txt
GET https://neupgroup.com/account/bridge/api.v1/auth/grant
  ?appId=YOUR_APP_ID
  &aid=USER_ACCOUNT_ID
  &sid=EXTERNAL_SESSION_ID
  &skey=EXTERNAL_SESSION_KEY
```

**Response (200):** `{ success: true, aid, appId, validTill, lastLoggedIn }`  
**Response (401):** `invalid_grant` when the grant is missing or expired.

### Step 6 — Refresh the external session (server‑to‑server PATCH)

Refreshing extends the external session by ~7 days and issues a new ~7‑minute JWT:

```http
PATCH https://neupgroup.com/account/bridge/api.v1/auth/grant
content-type: application/json

{
  "appId": "YOUR_APP_ID",
  "aid": "USER_ACCOUNT_ID",
  "sid": "EXTERNAL_SESSION_ID",
  "skey": "EXTERNAL_SESSION_KEY"
}
```

**Response (200):** `{ aid, sid, jwt, exp, role, per? }`  
**Response (401):** `invalid_session` when the session is missing or expired.

### Signout guidance

To sign the user out of your app:

1. delete your stored `sid/skey` (and any local cookie/session)
2. redirect to your logged‑out page

This does not automatically sign the user out of Neup.Account’s browser session.
