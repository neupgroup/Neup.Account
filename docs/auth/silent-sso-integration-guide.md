# Silent SSO Integration Guide

This guide covers the **current** NeupID Silent SSO integration for third‑party apps.

For the full end‑to‑end flow (including token/response examples), see:
`docs/silent-auth-token-flow.md`.

---

## Prerequisites

1. You have a registered application with an `appId` and `appSecret`.
2. Your application's HTTPS origin is registered as a **Silent SSO Origin** for your app.

In this repo, manage origins at:

`/application/[id]/config` → **Silent SSO Origins**

Only the scheme + host are used (paths are ignored). Origins must be HTTPS.

---

## Step 1 — Embed the hidden iframe

Load the silent SSO iframe anywhere you want to silently check auth:

```html
<iframe
  src="https://neupgroup.com/account/bridge/silent.v1/whoisthis?app=YOUR_APP_ID"
  style="display:none;width:0;height:0;border:0"
  id="neupid-sso-frame"
></iframe>
```

The iframe always returns `200`. Success/failure is communicated via `postMessage`.

---

## Step 2 — Listen for the postMessage

Listen for `message` events and validate `event.origin`.

```js
const NEUP_ORIGIN = 'https://neupgroup.com';

window.addEventListener('message', (event) => {
  if (event.origin !== NEUP_ORIGIN) return;

  const { type, success, token, response } = event.data ?? {};
  if (type !== 'neupid:silent_auth') return;

  if (success) {
    // token: { cid, aid?, iat, exp }
    // response: flat key→value map (name.display, account.type, contact.email, ...)
  } else {
    // unauthenticated/guest
  }
});
```

---

## Token and response shapes

`token` is always present and includes `cid`, `iat`, and `exp` (and `aid` only for party 1/2 apps).
`response` is an empty object when unauthenticated.

See `docs/silent-auth-token-flow.md` for the authoritative examples.

---

## Legacy note (PKCE exchange endpoint)

This repo still includes:

`POST /bridge/silent.v1/auth/exchange`

It exchanges a `silent_auth_code` for a WhoAmI‑style identity response.
The current iframe endpoint (`/bridge/silent.v1/whoisthis`) does **not** issue codes, so most integrations do not need this.

