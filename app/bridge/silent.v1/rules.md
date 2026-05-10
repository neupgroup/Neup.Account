# silent.v1 — Rules

## Purpose

`silent.v1` is exclusively for **postMessage-based communication** between
neup.account and third-party apps embedded via `<iframe>`. Every route in
this namespace must respond with an HTML page that fires
`window.parent.postMessage(payload, targetOrigin)` — never a raw JSON
response.

---

## Rules

### 1. postMessage only
All responses must be HTML pages that call `window.parent.postMessage`.
Never return `NextResponse.json(...)` or any direct JSON from a `silent.v1`
route. The parent frame is the only consumer.

### 2. Always validate origin
Every route must validate the calling `Origin` (or `Referer`) header against
registered silent SSO origins via `validateSilentSsoOrigin`. Unregistered
origins receive `{ ok: false, reason: 'origin_not_registered' }` and nothing
else.

### 3. Always set frame headers
Every HTML response must include:
```
X-Frame-Options: ALLOWALL
Content-Security-Policy: frame-ancestors *
Cache-Control: no-store
```

### 4. Message type convention
All postMessage payloads must include a `type` field prefixed with
`neupid:silent_` to avoid collisions with other postMessage listeners on the
parent page.

| Route   | type                    |
|---------|-------------------------|
| `init`  | `neupid:silent_init`    |
| `whoisthis` | `neupid:silent_auth` |

### 5. init is the entry point
`/bridge/silent.v1/init` must be called first by any third-party app before
calling `whoisthis` or `exchange`. It initializes the guest cookie
(`auth_account`) for the session. Without it, subsequent silent SSO calls
may fail due to a missing cookie.

### 6. No redirects
`silent.v1` routes must never redirect. A redirect breaks the iframe flow.
All error states must be communicated via postMessage with `ok: false` and
a `reason` string.

### 7. No sensitive data in postMessage
Never include session keys, raw JWTs (other than the signed identity token),
or private account data in postMessage payloads. The payload is visible to
the parent frame's origin.
