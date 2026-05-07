# Implementation Plan: Silent SSO

## Overview

Implement Silent SSO by building the Prisma schema, service layer, iframe page, exchange route, management UI, and property-based tests in sequence. Each step integrates with the previous one so there is no orphaned code. The service layer (`services/auth/silent-sso.ts`) is the foundation — all route handlers and pages call into it rather than touching Prisma directly.

## Tasks

- [x] 1. Add Identity model to Prisma schema and run migration
  - Add the `Identity` model to `prisma/schema.prisma` with fields: `id` (cuid), `accountId` (nullable), `appId`, `sessionId` (nullable), `originatedOn`, `refreshesOn`, `validTill`
  - Add `@@unique([accountId, appId])` and `@@map("identity")` directives
  - Add `identities Identity[]` back-relation to the `Account`, `Application`, and `AuthnSession` models
  - Run `npx prisma migrate dev --name add_identity_table` to generate and apply the migration
  - Run `npx prisma generate` to regenerate the Prisma client
  - _Requirements: 5.1_

- [x] 2. Implement `services/auth/silent-sso.ts` — core service layer
  - [x] 2.1 Implement `checkRateLimit(origin: string): boolean`
    - In-memory `Map<string, { count: number; windowStart: number }>` keyed by origin
    - Sliding window: 10 requests per origin per 60 000 ms
    - Returns `true` if allowed, `false` if rate-limited
    - _Requirements: 7.3_

  - [ ]* 2.2 Write property test for `checkRateLimit` (Property 7)
    - **Property 7: Rate limit enforcement**
    - **Validates: Requirements 7.3**

  - [x] 2.3 Implement `validateSilentSsoOrigin(origin: string): Promise<{ valid: boolean; appId: string | null }>`
    - Query `prisma.applicationBridge.findMany({ where: { type: 'silentSsoOrigin' } })`
    - Match by `new URL(record.value).origin === new URL(origin).origin` (scheme + host only)
    - Return `{ valid: true, appId }` on match, `{ valid: false, appId: null }` otherwise
    - Wrap in try/catch; log errors via `logError`
    - _Requirements: 3.1, 3.3, 3.4_

  - [ ]* 2.4 Write property test for `validateSilentSsoOrigin` (Property 3)
    - **Property 3: Origin validation correctness**
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [x] 2.5 Implement `resolveOrCreateIdentity(accountId: string, appId: string, sessionId: string | null): Promise<Identity>`
    - Use `prisma.identity.upsert` on `{ accountId_appId: { accountId, appId } }`
    - On create: set `originatedOn = now()`, `refreshesOn = now + 1 hour`, `validTill = now + 4 weeks`, `sessionId`
    - On update: set `sessionId` to the current value (keep `originatedOn` unchanged)
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [ ]* 2.6 Write property test for `resolveOrCreateIdentity` — idempotency (Property 4)
    - **Property 4: Identity idempotency (stable ssid)**
    - **Validates: Requirements 5.2**

  - [ ]* 2.7 Write property test for `resolveOrCreateIdentity` — temporal invariants (Property 2)
    - **Property 2: Identity temporal invariants**
    - **Validates: Requirements 5.4, 2.3**

  - [x] 2.8 Implement `signIdentityJwt(identity: Identity, appId: string): Promise<string>`
    - Fetch `application.appSecret` from `prisma.application.findUnique({ where: { id: appId } })`
    - Build payload: `{ ssid: identity.id, sid: identity.sessionId, originated_on, refreshes_on, expires_on }` (ISO 8601 strings)
    - Sign with `jwt.sign(payload, appSecret, { algorithm: 'HS256' })` — no `exp` claim
    - _Requirements: 2.3, 5.3_

  - [ ]* 2.9 Write property test for `signIdentityJwt` — round-trip (Property 1)
    - **Property 1: JWT round-trip preserves ssid**
    - **Validates: Requirements 2.3, 5.3**

  - [ ]* 2.10 Write property test for `signIdentityJwt` — no credentials in payload (Property 8)
    - **Property 8: JWT payload contains no session credentials**
    - **Validates: Requirements 7.2**

  - [x] 2.11 Implement `issueSilentAuthCode(accountId: string, appId: string, sessionId: string): Promise<{ code: string; identity: Identity }>`
    - Generate code: `crypto.randomBytes(48).toString('base64url')` (≥ 64 URL-safe chars)
    - Store as `prisma.authnRequest.create` with `type: 'silent_auth_code'`, `status: 'pending'`, `data: { appId, sessionId, codeChallenge?, codeChallengeMethod? }`, `accountId`, `expiresAt: now + 300s`
    - Call `resolveOrCreateIdentity` and return both code and identity
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.12 Implement `exchangeSilentAuthCode(appId: string, appSecret: string, code: string, codeVerifier?: string): Promise<{ status: number; body: Record<string, unknown> }>`
    - Fetch `prisma.authnRequest.findFirst({ where: { id: code, type: 'silent_auth_code', status: 'pending' } })`
    - Return 400 `invalid_code` if not found or expired (`expiresAt <= now`)
    - Return 400 `app_mismatch` if `data.appId !== appId`
    - Fetch application; return 401 `unauthorized` if `application.appSecret !== appSecret`
    - If PKCE: verify `SHA256(base64url(codeVerifier)) === data.codeChallenge`; return 400 `invalid_code_verifier` on failure
    - Atomically mark code used: `prisma.authnRequest.update({ where: { id: code, status: 'pending' }, data: { status: 'used' } })`
    - Call `resolveWhoAmI` with the stored `accountId` and `sessionId`; return its body
    - Log issuance/exchange events via `logError` context (without logging the code value)
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.4, 7.9_

  - [ ]* 2.13 Write property test for `exchangeSilentAuthCode` — single-use enforcement (Property 5)
    - **Property 5: Silent auth code single-use enforcement**
    - **Validates: Requirements 4.6, 4.7**

  - [ ]* 2.14 Write property test for `exchangeSilentAuthCode` — code bound to appId (Property 6)
    - **Property 6: Code is bound to its issuing appId**
    - **Validates: Requirements 7.4**

- [x] 3. Checkpoint — service layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement `app/bridge/silent.v1/auth/whoisthis/page.tsx`
  - [x] 4.1 Create the Next.js server component at `app/bridge/silent.v1/auth/whoisthis/page.tsx`
    - Accept `searchParams`: `appId?`, `codeChallenge?`, `codeChallengeMethod?`
    - Read `Origin` / `Referer` from `headers()` to determine the requesting origin
    - Set response headers via `headers()` from `next/headers`: `X-Frame-Options: ALLOWALL`, `Content-Security-Policy: frame-ancestors *`, `Referrer-Policy: no-referrer`
    - _Requirements: 1.1, 1.5, 7.7_

  - [x] 4.2 Wire session validation and identity resolution into the page
    - Call `checkRateLimit(origin)` — if false, inject failure payload `{ type: "neupid:silent_auth", authenticated: false, reason: "rate_limited" }`
    - Call `validateSilentSsoOrigin(origin)` — if invalid, inject `{ reason: "origin_not_registered" }`
    - Call `getSessionCookies()` — if no `accountId`/`sessionId`/`sessionKey`, inject `{ reason: "no_session" }`
    - Call `resolveWhoAmI({ accountId, sessionId, sessionKey })` — if not 200, inject `{ reason: "session_invalid" }`
    - On success: call `issueSilentAuthCode(accountId, appId, sessionId)`, call `signIdentityJwt(identity, appId)`, inject success payload `{ type: "neupid:silent_auth", authenticated: true, token, code }`
    - _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Render the HTML page with injected payload and inline postMessage script
    - Serialize the payload as JSON and inject it as a `data-payload` attribute on a `<div id="sso-payload">`
    - Add an inline `<script>` that reads `document.getElementById('sso-payload').dataset.payload`, parses it, and calls `window.parent.postMessage(payload, targetOrigin)` where `targetOrigin` is the exact registered origin (never `"*"`)
    - The page must always render and always dispatch a `postMessage` — never return a 4xx/5xx HTTP status
    - _Requirements: 1.6, 2.1, 2.7_

- [x] 5. Implement `app/bridge/silent.v1/auth/exchange/route.ts`
  - [x] 5.1 Create the POST route handler at `app/bridge/silent.v1/auth/exchange/route.ts`
    - Parse JSON body: `{ appId, appSecret, code, codeVerifier? }`
    - Return 400 `invalid_request` if any required field is missing
    - Check `request.headers.get('origin')` — if it matches any registered `silentSsoOrigin`, return 403 `browser_origin_forbidden`
    - Delegate to `exchangeSilentAuthCode(appId, appSecret, code, codeVerifier)`
    - Return the service result with the appropriate HTTP status
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8, 7.1, 7.8_

- [x] 6. Add `silentSsoOrigin` server actions to `services/applications/manage.ts`
  - [x] 6.1 Add `getSilentSsoOrigins(appId: string): Promise<Array<{ id: string; value: string }>>` server action
    - Query `prisma.applicationBridge.findMany({ where: { appId, type: 'silentSsoOrigin' } })`
    - Enforce `canView` authorization via `getApplicationAuthorization`
    - _Requirements: 3.5, 3.6_

  - [x] 6.2 Add `addSilentSsoOrigin(input: { appId: string; origin: string }): Promise<{ success: boolean; error?: string }>` server action
    - Validate `origin` is a valid URL with scheme `https`
    - Enforce `canEdit` authorization
    - Create `prisma.applicationBridge.create({ data: { appId, type: 'silentSsoOrigin', value: origin } })`
    - Call `revalidatePath` for the application page
    - _Requirements: 3.5, 3.6_

  - [x] 6.3 Add `removeSilentSsoOrigin(input: { appId: string; bridgeId: string }): Promise<{ success: boolean; error?: string }>` server action
    - Enforce `canEdit` authorization
    - Delete `prisma.applicationBridge.delete({ where: { id: bridgeId, appId, type: 'silentSsoOrigin' } })`
    - Call `revalidatePath` for the application page
    - _Requirements: 3.5, 3.6_

- [x] 7. Add Silent SSO Origins section to `ApplicationManagementPanel`
  - [x] 7.1 Create `app/(manage)/data/applications/[id]/silent-sso-origins/page.tsx`
    - Server component that fetches current origins via `getSilentSsoOrigins(appId)`
    - Renders a list of registered origins with a remove button per entry
    - Renders an "Add Origin" form with a URL input field
    - Calls `addSilentSsoOrigin` / `removeSilentSsoOrigin` server actions on submit
    - _Requirements: 3.5, 3.6_

  - [x] 7.2 Add a "Silent SSO Origins" card to `ApplicationManagementPanel`
    - Add a new `Card` section below the existing "Endpoints and Actions" card
    - Display the current list of `silentSsoOrigin` entries (fetched as a prop or via a client-side fetch)
    - Provide an inline add-origin input and a remove button per entry, wired to the server actions from task 6
    - _Requirements: 3.5, 3.6_

- [x] 8. Write PBT tests in `tests/auth/silent-sso.test.ts`
  - [x] 8.1 Scaffold the test file with mocks for `prisma` and `jsonwebtoken`
    - Mock `@/core/helpers/prisma` with `vi.mock`
    - Import `fc` from `fast-check` and all functions under test from `@/services/auth/silent-sso`
    - _Requirements: all_

  - [ ]* 8.2 Write property test for Property 1 — JWT round-trip preserves ssid
    - `// Feature: silent-sso, Property 1: JWT round-trip preserves ssid`
    - Arbitrary: `fc.record({ id: fc.string({ minLength: 1 }), sessionId: fc.option(fc.string()), originatedOn: fc.date(), refreshesOn: fc.date(), validTill: fc.date() })`
    - Sign with a fixed `appSecret`, decode with `jwt.decode`, assert all five payload fields match
    - **Property 1: JWT round-trip preserves ssid**
    - **Validates: Requirements 2.3, 5.3**

  - [ ]* 8.3 Write property test for Property 2 — Identity temporal invariants
    - `// Feature: silent-sso, Property 2: Identity temporal invariants`
    - Arbitrary: `fc.date()` for `originatedOn`
    - Mock `prisma.identity.upsert` to return a computed record; assert `validTill = originatedOn + 4 weeks ± 1s`, `refreshesOn > originatedOn`, `refreshesOn < validTill`
    - **Property 2: Identity temporal invariants**
    - **Validates: Requirements 5.4, 2.3**

  - [ ]* 8.4 Write property test for Property 3 — Origin validation correctness
    - `// Feature: silent-sso, Property 3: Origin validation correctness`
    - Arbitrary: `fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 })` for registered origins; `fc.webUrl()` for test URL
    - Mock `prisma.applicationBridge.findMany` to return the generated set; assert match/no-match by scheme+host
    - **Property 3: Origin validation correctness**
    - **Validates: Requirements 3.1, 3.3, 3.4**

  - [ ]* 8.5 Write property test for Property 4 — Identity idempotency
    - `// Feature: silent-sso, Property 4: Identity idempotency (stable ssid)`
    - Arbitrary: `fc.string({ minLength: 1 })` for `accountId`, `fc.string({ minLength: 1 })` for `appId`
    - Mock `prisma.identity.upsert` to simulate upsert semantics (return same `id` on second call); assert returned `id` is identical across two calls
    - **Property 4: Identity idempotency (stable ssid)**
    - **Validates: Requirements 5.2**

  - [ ]* 8.6 Write property test for Property 5 — Single-use code enforcement
    - `// Feature: silent-sso, Property 5: Silent auth code single-use enforcement`
    - Arbitrary: `fc.string({ minLength: 1 })` for `accountId`, `appId`
    - Mock `prisma.authnRequest` to simulate pending → used state transition; assert first exchange succeeds, second returns `invalid_code`
    - **Property 5: Silent auth code single-use enforcement**
    - **Validates: Requirements 4.6, 4.7**

  - [ ]* 8.7 Write property test for Property 6 — Code bound to issuing appId
    - `// Feature: silent-sso, Property 6: Code is bound to its issuing appId`
    - Arbitrary: two distinct `fc.string({ minLength: 1 })` values for `appIdA` and `appIdB`
    - Mock `prisma.authnRequest.findFirst` to return a record with `data.appId = appIdA`; call exchange with `appIdB`; assert `app_mismatch`
    - **Property 6: Code is bound to its issuing appId**
    - **Validates: Requirements 7.4**

  - [ ]* 8.8 Write property test for Property 7 — Rate limit enforcement
    - `// Feature: silent-sso, Property 7: Rate limit enforcement`
    - Arbitrary: `fc.webUrl()` for origin
    - Reset the module-level `rateLimitMap` before each run; call `checkRateLimit` 10 times (all true), assert 11th returns false; advance time by 60 001 ms; assert next call returns true
    - **Property 7: Rate limit enforcement**
    - **Validates: Requirements 7.3**

  - [ ]* 8.9 Write property test for Property 8 — No credentials in JWT
    - `// Feature: silent-sso, Property 8: JWT payload contains no session credentials`
    - Arbitrary: `fc.record({ id: fc.string({ minLength: 1 }), sessionId: fc.option(fc.string()), ... })` for identity; `fc.string({ minLength: 16 })` for `appSecret`
    - Decode the signed JWT; assert payload keys are exactly `{ ssid, sid, originated_on, refreshes_on, expires_on }` and no value equals the raw `appSecret`
    - **Property 8: JWT payload contains no session credentials**
    - **Validates: Requirements 7.2**

- [x] 9. Final checkpoint — Ensure all tests pass
  - Run `npx vitest --run tests/auth/silent-sso.test.ts` and confirm all tests pass.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The service layer (task 2) must be complete before the page (task 4) and route (task 5) are implemented
- The Prisma migration (task 1) must be applied before any service function that touches the `identity` table can be tested against a real database
- PBT tests (task 8) mock Prisma and can be written and run at any point after the service layer exists
- Each property test references a specific property number from the design document for traceability
- The `whoisthis` page always returns HTTP 200 and always dispatches a `postMessage` — failure cases are communicated through the payload, not HTTP status codes
- The exchange endpoint is server-to-server only; browser `Origin` header detection enforces this at the route level
