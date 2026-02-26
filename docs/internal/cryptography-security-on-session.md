# Cryptography and Session Security

This document explains the cryptographic mechanisms implemented to secure user permissions and session data within the application.

## Overview

To prevent users from manually modifying their permissions in `sessionStorage` (e.g., via Browser DevTools), the application uses an asymmetric cryptographic signing mechanism. This ensures that any permission used by the frontend has been explicitly authorized and signed by the server.

## Key Components

### 1. Asymmetric Key Pair (RSA-2048)
- **Private Key (Server-Side)**: Stored securely on the server (in `src/lib/crypto.ts`). It is used to create digital signatures for the permission sets.
- **Public Key (Client-Side)**: Hardcoded in the frontend (`src/context/session-context.tsx`). It is used to verify that the signatures were created by the corresponding private key.

### 2. Digital Signatures (RSA-SHA256)
Instead of just encrypting the data, the server generates a cryptographic hash of the permissions and signs it with the Private Key. This provides **Integrity** (the data hasn't changed) and **Authenticity** (the data came from the server).

## Security Flow

### A. Server-Side: Signing
1. The server fetches the user's permissions from the database.
2. The permissions array is stringified: `["root.admin", "user.view"]`.
3. The server uses the **Private Key** to sign this string using the RSA-SHA256 algorithm.
4. The server returns a base64-encoded payload containing:
   - `data`: The base64-encoded permission string.
   - `signature`: The cryptographic signature.

### B. Client-Side: Verification
1. The `SessionProvider` receives the encoded payload.
2. It uses the **Pinned Public Key** (hardcoded in the app) to verify the signature against the data using the `window.crypto.subtle` API.
3. **If verification succeeds**: The permissions are trusted and loaded into the application state.
4. **If verification fails**: This indicates the data has been tampered with or the key is invalid.

## Protection Mechanisms

### 1. Tamper Detection
If a user modifies the `permissions` array in `sessionStorage`, the `SessionProvider` will detect on the next load that the stored permissions no longer match the signed `encodedPermissions` payload.

### 2. Public Key Pinning
Even if a user generates their own RSA key pair and replaces the public key in `sessionStorage`, the application will ignore the stored key and use the **Pinned Public Key** hardcoded in the source code. This prevents "Key Substitution" attacks.

### 3. Automatic Revocation
When tampering is detected, the application:
1. Rejects the current cached session.
2. Automatically initiates a fresh request to the server to re-validate and fetch legitimate, signed permissions.

## Implementation Locations
- **Signing Logic**: [crypto.ts](file:///Users/neupkishor/Documents/neupaccount/src/lib/crypto.ts)
- **Verification Logic**: [session-context.tsx](file:///Users/neupkishor/Documents/neupaccount/src/context/session-context.tsx)
- **Permissions API**: [route.ts](file:///Users/neupkishor/Documents/neupaccount/src/app/bridge/api/permissions/route.ts)
