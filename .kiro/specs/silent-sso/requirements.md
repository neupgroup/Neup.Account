# Requirements Document

## Introduction

Silent SSO enables NeupID (the central identity provider at `auth.neupid.com` / `neupgroup.com/account`) to silently authenticate users across registered applications without showing a login screen. When a user is already signed in to one NeupID-connected app, any other registered app can embed a hidden iframe pointing to the `whoisthis` endpoint. The auth server checks the session cookie, and if valid, returns a short-lived authorization code via `postMessage`. The client app exchanges that code server-to-server for a session. If the silent check fails (no session, third-party cookie blocked, or unregistered origin), the system falls back to a visible redirect-based OAuth2/OIDC flow.

This feature extends the existing handshake and `whoami` infrastructure. It introduces:
- A new `whoisthis` iframe endpoint on the auth server
- A `postMessage`-based response protocol
- A short-lived authorization code issued by the auth server
- A server-to-server code exchange endpoint
- Application registration fields for allowed iframe origins
- Browser compatibility fallbacks for Safari/Brave/Firefox ITP

---

## Glossary

- **Auth_Server**: The NeupID identity provider running at `neupgroup.com/account` (also reachable as `auth.neupid.com`).
- **Client_App**: A third-party or first-party application registered in the NeupID system that wants to silently authenticate its users.
- **Whoisthis_Endpoint**: The iframe-embeddable page at `GET /bridge/silent.v1/auth/whoisthis` served by the Auth_Server.
- **Silent_Auth_Code**: A short-lived, single-use authorization code issued by the Auth_Server to a successfully authenticated iframe session.
- **Identity**: A persistent database record representing a site-scoped identity for a `(account_id, app_id)` pair, whose `id` field becomes the `ssid` in the signed JWT.
- **Code_Exchange_Endpoint**: The server-to-server endpoint `POST /bridge/silent.v1/auth/exchange` that converts a Silent_Auth_Code into a verified user identity.
- **postMessage_Protocol**: The browser `window.postMessage` API used by the Whoisthis_Endpoint to communicate the authentication result to the parent window.
- **Allowed_Origin**: A domain registered in the `ApplicationBridge` table (type `silentSsoOrigin`) for a specific application, authorizing that origin to receive `postMessage` responses.
- **Session_Cookie**: The `HttpOnly; Secure; SameSite=None; Domain=.neupid.com` cookie set by the Auth_Server after a user signs in.
- **ITP**: Intelligent Tracking Prevention — the third-party cookie blocking mechanism in Safari, Brave, and Firefox strict mode.
- **PKCE**: Proof Key for Code Exchange — an OAuth2 extension that prevents authorization code interception attacks.
- **Fallback_Redirect**: A visible browser redirect to the Auth_Server that immediately redirects back to the Client_App after confirming the session, used when silent iframe auth is not possible.
- **Temp_Token**: The existing short-lived one-time token already issued by the handshake flow (5-minute lifetime), reused as the Silent_Auth_Code mechanism.
- **ApplicationBridge**: The existing Prisma model that stores per-application configuration entries (type + value pairs), extended to support `silentSsoOrigin` entries.

---

## Requirements

### Requirement 1: Whoisthis Iframe Endpoint

**User Story:** As a Client_App developer, I want to embed a hidden iframe pointing to the Auth_Server's `whoisthis` endpoint, so that I can silently check whether the current browser user has an active NeupID session without redirecting them.

#### Acceptance Criteria

1. THE Auth_Server SHALL serve a page at `GET /bridge/silent.v1/auth/whoisthis` that is embeddable as an iframe.
2. WHEN the Whoisthis_Endpoint receives a request that includes a valid Session_Cookie, THE Auth_Server SHALL generate a Silent_Auth_Code and send a `postMessage` to the parent window with the payload `{ authenticated: true, code: "<Silent_Auth_Code>" }`.
3. WHEN the Whoisthis_Endpoint receives a request that does not include a valid Session_Cookie, THE Auth_Server SHALL send a `postMessage` to the parent window with the payload `{ authenticated: false }`.
4. WHEN the Whoisthis_Endpoint receives a request whose `Referer` or `Origin` header does not match any Allowed_Origin registered for the requesting application, THE Auth_Server SHALL send a `postMessage` with `{ authenticated: false, error: "origin_not_registered" }` and SHALL NOT issue a Silent_Auth_Code.
5. THE Auth_Server SHALL set `X-Frame-Options: ALLOWALL` and a permissive `Content-Security-Policy: frame-ancestors` header on the Whoisthis_Endpoint response to allow cross-origin iframe embedding by registered origins.
6. THE Auth_Server SHALL complete the session check and dispatch the `postMessage` within 2000ms of the iframe page load.

---

### Requirement 2: postMessage Response Protocol

**User Story:** As a Client_App developer, I want a well-defined `postMessage` protocol from the `whoisthis` iframe, so that my frontend JavaScript can reliably parse the authentication result and act on it.

#### Acceptance Criteria

1. THE Whoisthis_Endpoint SHALL dispatch all `postMessage` calls with `targetOrigin` set to the exact Allowed_Origin that matches the parent window's origin, never `"*"`.
2. THE Auth_Server SHALL include a `type` field with value `"neupid:silent_auth"` in every `postMessage` payload, so that Client_App listeners can distinguish NeupID messages from other iframe messages.
3. WHEN authentication succeeds, THE Auth_Server SHALL include `{ type: "neupid:silent_auth", authenticated: true, token: "<signed JWT>" }` in the `postMessage` payload, where the JWT payload contains exactly `{ ssid, sid, originated_on, refreshes_on, expires_on }` and no other user identity fields.
4. WHEN authentication fails due to no session, THE Auth_Server SHALL include `{ type: "neupid:silent_auth", authenticated: false, reason: "no_session" }` in the `postMessage` payload.
5. WHEN authentication fails due to an unregistered origin, THE Auth_Server SHALL include `{ type: "neupid:silent_auth", authenticated: false, reason: "origin_not_registered" }` in the `postMessage` payload.
6. WHEN authentication fails due to a blocked or expired session, THE Auth_Server SHALL include `{ type: "neupid:silent_auth", authenticated: false, reason: "session_invalid" }` in the `postMessage` payload.
7. THE Client_App SDK SHALL validate the `event.origin` of every received `postMessage` against the known Auth_Server origin before processing the payload.

---

### Requirement 3: Origin and Domain Validation Against Registered Applications

**User Story:** As a NeupID platform operator, I want the `whoisthis` endpoint to only respond to origins that are explicitly registered for a given application, so that unauthorized sites cannot silently harvest authentication codes.

#### Acceptance Criteria

1. THE Auth_Server SHALL resolve the requesting application by matching the iframe request's `Origin` or `Referer` header against `ApplicationBridge` records of type `silentSsoOrigin`.
2. WHEN no matching `silentSsoOrigin` record exists for the incoming origin, THE Auth_Server SHALL reject the request and SHALL NOT issue a Silent_Auth_Code.
3. THE Auth_Server SHALL perform origin matching by comparing scheme and host only (ignoring path and query string), consistent with the existing `whoami` origin-matching logic.
4. THE Auth_Server SHALL support multiple `silentSsoOrigin` entries per application, allowing a single application to authorize several distinct domains (e.g., `https://app.neupid.com` and `https://tourio.com`).
5. WHEN an application owner adds or removes a `silentSsoOrigin` entry via the application management panel, THE Auth_Server SHALL reflect the change on the next iframe request without requiring a server restart.
6. THE application management panel SHALL allow application owners to add, view, and remove `silentSsoOrigin` entries for their application.
7. THE Auth_Server SHALL log each rejected origin attempt with the incoming origin value and the application ID that was looked up, for audit purposes.

---

### Requirement 4: Silent Auth Code Issuance and Server-to-Server Exchange

**User Story:** As a Client_App backend developer, I want to exchange the short-lived code received via `postMessage` for a verified user identity, so that I can establish a server-side session without ever exposing session credentials to the browser.

#### Acceptance Criteria

1. THE Auth_Server SHALL generate a Silent_Auth_Code as a cryptographically random, URL-safe string of at least 32 bytes.
2. THE Auth_Server SHALL store the Silent_Auth_Code server-side with an expiry of 300 seconds (5 minutes) from issuance.
3. THE Auth_Server SHALL associate each Silent_Auth_Code with the `accountId`, `sessionId`, and the `appId` of the requesting application at issuance time.
4. THE Auth_Server SHALL expose a `POST /bridge/silent.v1/auth/exchange` endpoint that accepts `{ appId, appSecret, code, codeVerifier }` and returns the verified user identity on success.
5. WHEN a valid, unexpired Silent_Auth_Code is presented with the correct `appId` and `appSecret`, THE Code_Exchange_Endpoint SHALL return `{ success: true, accountId, neupId, displayName, displayImage, accountType, verified }`.
6. WHEN an invalid, expired, or already-used Silent_Auth_Code is presented, THE Code_Exchange_Endpoint SHALL return `{ success: false, error: "invalid_code" }` with HTTP status 400.
7. THE Auth_Server SHALL invalidate a Silent_Auth_Code immediately after it is successfully exchanged (single-use enforcement).
8. THE Code_Exchange_Endpoint SHALL require HTTPS and SHALL reject requests that do not include a valid `appSecret` matching the application record.
9. WHEN PKCE is enabled for an application, THE Auth_Server SHALL require a `codeVerifier` in the exchange request and SHALL verify it against the `codeChallenge` stored at code issuance time.
10. THE Auth_Server SHALL accept the `codeChallenge` and `codeChallengeMethod` (S256 only) as query parameters on the `whoisthis` iframe URL at load time, storing them alongside the pending Silent_Auth_Code.

---

### Requirement 5: Identity Table

**User Story:** As a NeupID platform operator, I want a persistent `Identity` record created for each successful silent auth, so that the auth server can issue a stable, site-scoped identity token (`ssid`) that tracks a user's relationship with a specific application over time.

#### Acceptance Criteria

1. THE Auth_Server SHALL maintain an `Identity` table with the following schema:
   ```
   Identity {
     id            String   @id @default(cuid())
     account_id    String?  // nullable, references Account.id
     app_id        String   // references Application.id
     session_id    String?  // nullable, references AuthnSession.id
     originated_on DateTime @default(now())
     refreshes_on  DateTime // when the identity token will be refreshed
     valid_till    DateTime // originated_on + 4 weeks
   }
   ```
2. WHEN a silent authentication succeeds for a given `(account_id, app_id)` pair, THE Auth_Server SHALL look up an existing `Identity` record for that pair or create a new one if none exists.
3. THE Auth_Server SHALL use the `id` field of the resolved `Identity` record as the `ssid` value in the signed JWT delivered via `postMessage`.
4. THE Auth_Server SHALL set `valid_till` to exactly `originated_on + 4 weeks` for every `Identity` record.
5. THE Auth_Server SHALL allow `account_id` to be null on an `Identity` record to support unauthenticated or anonymous identity tracking.
6. THE Auth_Server SHALL allow `session_id` to be null on an `Identity` record; THE Auth_Server SHALL only populate `session_id` when the user has an active authenticated session at the time of silent auth.
7. THE Auth_Server SHALL set `session_id` on the `Identity` record to the current `AuthnSession.id` WHEN the user is authenticated, and SHALL leave it null WHEN the user is unauthenticated.

---

### Requirement 6: Browser Compatibility and ITP Fallback

**User Story:** As a Client_App developer, I want a reliable fallback when the silent iframe check fails due to third-party cookie blocking (Safari ITP, Brave, Firefox strict mode), so that users on those browsers are still authenticated with minimal friction.

#### Acceptance Criteria

1. WHEN the Client_App receives `{ authenticated: false }` from the `postMessage` protocol, THE Client_App SDK SHALL initiate the Fallback_Redirect flow by navigating the browser to the existing handshake endpoint `GET /bridge/handshake.v1/auth/grant` with the appropriate `appId` and `authenticatesTo` parameters.
2. THE Client_App SDK SHALL implement a configurable timeout of 10000ms; IF the `whoisthis` iframe does not dispatch a `postMessage` within the timeout period, THEN THE Client_App SDK SHALL treat the result as `{ authenticated: false }` and initiate the Fallback_Redirect flow.
3. WHEN the Auth_Server detects that the user is already authenticated during the Fallback_Redirect flow, THE Auth_Server SHALL redirect back to the `authenticatesTo` URL immediately without showing a login screen, appending a `tempToken` as in the existing handshake flow.
4. THE Client_App SDK SHALL remove the hidden iframe from the DOM after receiving the `postMessage` response or after the timeout, to avoid resource leaks.
5. THE Auth_Server SHALL set `SameSite=None; Secure` on the Session_Cookie to allow it to be sent in cross-site iframe requests in browsers that still permit third-party cookies.
6. THE Auth_Server SHALL document in the integration guide that Safari 17+, Brave, and Firefox with strict tracking protection will block the iframe cookie, that the Fallback_Redirect is the expected path for those browsers, and that the auth server is hosted at `neupgroup.com`.

---

### Requirement 7: Security Constraints

**User Story:** As a NeupID security engineer, I want the Silent SSO system to enforce strict security controls, so that the feature does not introduce token leakage, session hijacking, or cross-site request forgery vulnerabilities.

#### Acceptance Criteria

1. THE Auth_Server SHALL only issue Silent_Auth_Codes over HTTPS connections; IF a request arrives over HTTP, THEN THE Auth_Server SHALL reject it with HTTP status 400.
2. THE Auth_Server SHALL never include the Session_Cookie value, `sessionKey`, or `sessionId` in any `postMessage` payload or in the Silent_Auth_Code exchange response.
3. THE Auth_Server SHALL enforce a rate limit of 10 Silent_Auth_Code issuance requests per origin per minute; IF the limit is exceeded, THEN THE Auth_Server SHALL respond with HTTP status 429 and SHALL NOT issue a code.
4. THE Auth_Server SHALL bind each Silent_Auth_Code to the `appId` it was issued for; IF the `appId` in the exchange request does not match the `appId` stored with the code, THEN THE Code_Exchange_Endpoint SHALL return `{ success: false, error: "app_mismatch" }`.
5. THE Auth_Server SHALL rotate the Session_Cookie on each successful silent authentication to prevent session fixation attacks.
6. WHEN a user's session is invalidated (logout or forced expiry), THE Auth_Server SHALL invalidate all outstanding Silent_Auth_Codes associated with that session.
7. THE Auth_Server SHALL include a `Referrer-Policy: no-referrer` header on the Whoisthis_Endpoint response to prevent the auth server URL from leaking to third-party analytics on the Client_App.
8. THE Code_Exchange_Endpoint SHALL only be callable from server-side environments; THE Auth_Server SHALL reject exchange requests that include a browser `Origin` header matching a registered `silentSsoOrigin` (i.e., direct browser calls are forbidden).
9. THE Auth_Server SHALL log all Silent_Auth_Code issuance and exchange events with timestamp, `appId`, origin, and outcome for security audit purposes, without logging the code value itself.
