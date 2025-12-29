# Fix: Automatic Logout Issue

## Problem 1: Server-Side Redirect in Client Component
Users were experiencing automatic logout immediately after logging in. The account management system would log users out right after successful authentication.

### Root Cause
The issue was in `/src/context/session-context.tsx`. The `SessionProvider` component was calling `validateCurrentSession()` on every page load (line 61). 

`validateCurrentSession()` is a **server action** (defined in `auth-actions.ts`) that performs a server-side redirect if the session is invalid. When this server action was called from a **client component** (SessionProvider is marked with `'use client'`), it caused unexpected redirect behavior.

Specifically:
1. User logs in successfully
2. Session cookies are set
3. Page loads and SessionProvider mounts
4. `validateCurrentSession()` is called from the client
5. The server-side redirect triggers immediately, logging the user out

### Solution
Modified the `SessionProvider` to handle session validation on the client side without using server-side redirects:

1. **Removed** the `validateCurrentSession()` call
2. **Changed** to directly call `getActiveAccountId()` and `getPersonalAccountId()`
3. **Added** client-side redirect logic that only triggers when:
   - Session is invalid (no activeId or personalId)
   - User is on a protected route (starts with `/manage`)
4. **Improved** error handling to properly set loading state to false

### Changes Made
- **File**: `/src/context/session-context.tsx`
- **Lines modified**: 6-7, 60-73, 95-100
- **Key changes**:
  - Removed `validateCurrentSession` import and call
  - Added conditional client-side redirect
  - Improved error state handling

---

## Problem 2: Cookies Not Working on Localhost (HTTP)
After the first fix, users could still not stay logged in during local development. The login flow would complete (NeupID → Password → TOTP) but then immediately redirect back to login.

### Root Cause
The cookie configuration in `/src/lib/cookies.ts` had `secure: true` set unconditionally. The `secure` flag requires cookies to be sent only over HTTPS connections. Since local development runs on HTTP (http://localhost:3000), the browser was **refusing to set the cookies**, causing the session to never be established.

### Solution
Modified the cookie options to conditionally set the `secure` flag based on the environment:
- **Development** (`NODE_ENV !== 'production'`): `secure: false` - allows cookies on HTTP (localhost)
- **Production** (`NODE_ENV === 'production'`): `secure: true` - enforces HTTPS for security

### Changes Made
- **File**: `/src/lib/cookies.ts`
- **Line modified**: 17
- **Change**: `secure: true` → `secure: process.env.NODE_ENV === 'production'`

---

## Testing
After both fixes:
1. Users should be able to log in successfully on localhost
2. Session should persist across page refreshes
3. Cookies work properly in both development (HTTP) and production (HTTPS)
4. Users should only be logged out when:
   - Session actually expires
   - Session is invalid
   - User manually logs out

## Technical Details
- Server actions with redirects should not be called from client components
- Client-side redirects using `window.location.href` are more appropriate for client components
- Session validation should happen server-side only for server components and API routes
- The `secure` cookie flag must be `false` for HTTP connections (development) and `true` for HTTPS (production)
