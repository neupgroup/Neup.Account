# Auth APIs — Endpoint Reference & When to Use What

This page documents the **auth-related HTTP endpoints** exposed by Neup.Account, and when each one should be used.

If you are integrating authentication for another application, start with `docs/authentication.md`. This file is the “API index” for the underlying routes.

**Base URL:** `https://neupgroup.com/account`

---

## Quick chooser

- **You need interactive sign-in / consent (redirect):** `GET /bridge/handshake.v1/auth/grant`
- **You need silent SSO (hidden iframe + postMessage):** `GET /bridge/silent.v1/whoisthis`
- **You need an app-scoped API bearer token (JWT):** `POST /bridge/api.v1/auth/token`
- **You need to validate or expire a token (server-to-server):** `POST /bridge/api.v1/auth/validate`, `POST /bridge/api.v1/auth/expire`
- **You need internal session keepalive / logout (cookie triplet):** `POST /bridge/api.v1/auth/session`, `DELETE /bridge/api.v1/auth/session`
- **You need cross-origin “who am I?” using cookies:** `GET /bridge/api.v1/auth/whoami`
- **You need application analytics (users/roles/access):** `GET /bridge/api.v1/application/users|roles|access` (see `docs/application.md`)

---

## Redirect handshake (browser redirect)

### GET `/bridge/handshake.v1/auth/grant`

**When to use:** external sign-in / sign-up where the user may need to login or consent.

```http
GET /account/bridge/handshake.v1/auth/grant
  ?app=YOUR_APP_ID
  &authenticatesTo=https://yourapp.com/auth/callback
```

Notes:

- `appId` is not accepted. Use `app`.
- `authenticatesTo` must be registered for your app (ApplicationBridge type `authenticatesTo`).
- On success the callback receives a short-lived `tempToken`.
- Exchange the `tempToken` with `POST /bridge/api.v1/auth/grant`.

---

## Silent SSO (iframe + postMessage)

### GET `/bridge/silent.v1/whoisthis`

**When to use:** silent “already logged in?” checks without a redirect.

```http
GET /account/bridge/silent.v1/whoisthis?app=YOUR_APP_ID
```

Rules:

- Browser origin must be registered as a `silentSsoOrigin` for the app.
- Response is **HTML** that posts to the parent frame via `window.parent.postMessage(...)`.
- Message type: `neupid:silentAuth`.

> The `POST /bridge/silent.v1/auth/exchange` endpoint exists for legacy PKCE-style silent auth code exchange, but most integrations should not need it.

---

## External handshake session (grant)

### POST `/bridge/api.v1/auth/grant`

**When to use:** exchange `tempToken` from the redirect handshake into a durable external session (`sid` + `skey`) and a signed token.

```http
POST /account/bridge/api.v1/auth/grant
content-type: application/json

{
  "app": "YOUR_APP_ID",
  "tempToken": "TOKEN_FROM_CALLBACK"
}
```

Response (200) includes:

- `aid` — accountId
- `sid`, `skey` — external session
- `token` — signed JWT for the external session (also returned as `jwt` for compatibility)

### GET `/bridge/api.v1/auth/grant`

**When to use:** check whether a previously issued (`aid`, `sid`, `skey`) session is still valid.

```http
GET /account/bridge/api.v1/auth/grant
  ?app=YOUR_APP_ID
  &aid=...
  &sid=...
  &skey=...
```

### PATCH `/bridge/api.v1/auth/grant`

**When to use:** refresh an external session and get a new short-lived JWT.

Recommended (token-based):

```http
PATCH /account/bridge/api.v1/auth/grant
content-type: application/json

{
  "token": "TOKEN_FROM_COOKIES_OR_STORAGE"
}
```

Legacy (triplet-based):

```http
PATCH /account/bridge/api.v1/auth/grant
content-type: application/json

{
  "app": "YOUR_APP_ID",
  "aid": "...",
  "sid": "...",
  "skey": "..."
}
```

---

## Token validation / signout (server-to-server)

### POST `/bridge/api.v1/auth/validate`

**When to use:** validate a token (server-to-server).

- If `?app=` is provided, the token is treated as an external-app HS256 JWT.
- If `?app=` is omitted, the token is treated as the base account `auth_account` RS256 token (first-party).

```http
POST /account/bridge/api.v1/auth/validate?app=YOUR_APP_ID
content-type: application/json

{ "token": "..." }
```

### POST `/bridge/api.v1/auth/expire`

**When to use:** expire/logout the session associated with a token (server-to-server).

```http
POST /account/bridge/api.v1/auth/expire?app=YOUR_APP_ID
content-type: application/json

{ "token": "..." }
```

---

## Cookie-session maintenance (internal)

### POST `/bridge/api.v1/auth/session`

**When to use:** validate and extend the cookie-backed session (internal keepalive).

### DELETE `/bridge/api.v1/auth/session`

**When to use:** invalidate a cookie-backed session.

---

## Cross-origin “who am I?” (cookies)

### GET `/bridge/api.v1/auth/whoami`

**When to use:** a browser app wants to read the currently logged-in user identity using cookies (`credentials: 'include'`), but only if the browser origin is registered as an `authenticatesTo` origin.

---

## Auth access (roles/permissions/team)

### GET `/bridge/api.v1/auth/access`

**When to use:** fetch auth access context for a user/session.

---

## Legacy endpoints

### POST `/bridge/api.v1/auth/sign` and `/bridge/api.v1/auth/signout`

Older integration endpoints that predate the current handshake + grant flow.

For new external integrations prefer:

- `GET /bridge/handshake.v1/auth/grant` + `POST /bridge/api.v1/auth/grant` (redirect handshake), and
- `GET /bridge/silent.v1/whoisthis` (silent SSO)
