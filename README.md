# Neup.Account Documentation & Integration Guide

This comprehensive guide covers everything from technical specifications for external integrations to internal security mechanisms within the **Neup.Account** ecosystem.

---

## 1. Application Definitions

| Type | Definition |
| :--- | :--- |
| **Internal Apps** | Applications developed by the **Neup Group**. |
| **External Apps** | Applications developed by **other users**, regardless of the domain they reside on. |

---

## 2. Authentication Flow (Handshake)

Before an application can verify a session, it must initiate a handshake to obtain the necessary credentials.

### Start Handshake
- **Endpoint**: `GET /bridge/handshake.v1/auth/signin`
- **Purpose**: Start a user authentication handshake from your app.
- **Required query params**:
  - `appId`: Your application ID registered with Neup.
  - `auth_handler`: Your server callback URL that receives the one-time key after the user signs in.
- **Optional query params**: Any additional parameters you include will be forwarded to your `auth_handler` unchanged.

### How it works
1. If the user is not signed in, they are redirected to `/auth/start?redirects=…`.
2. After successful sign-in, the handshake redirects the user to your `auth_handler` and appends:
   - `key`: A short-lived, one-time key (5 minutes) for server-to-server verification.
   - `session_id`: The user’s session ID in Neup.Account.
   - `account_id`: The authenticated user’s account ID.
   - `expiresOn`: The key’s expiration timestamp in ISO format.
3. Your app server must then verify the key via the verification API before granting access.

**Example Request:**
```
GET https://neupgroup.com/account/bridge/handshake.v1/auth/signin?appId=YOUR_APP_ID&auth_handler=https://yourapp.com/auth/callback&state=xyz
```

**Example Redirect:**
```
https://yourapp.com/auth/callback?state=xyz&key=ONE_TIME_KEY&session_id=SESSION_ID&account_id=ACCOUNT_ID&expiresOn=ISO_DATE
```

---

## 3. External Application Integration

External applications interact with Neup.Account primarily through the **"Sign"** endpoint.

### The "Sign" Process
External apps perform a POST request to exchange credentials (received via the handshake) for a session.

**Endpoint:** `POST https://neupgroup.com/account/bridge/api.v1/auth/sign`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "auth_account_id": "...",
  "auth_session_id": "...",
  "auth_session_key": "..."
}
```

**Response Properties:**
- `sessionValue`: A unique token the external app should use for its own session management. Once this token is obtained, the app does not need to call other Neup endpoints for basic session maintenance.
- `activeTill`: Expiration date for the `sessionValue`.
- `user`: Object containing `accountId`, `displayName`, `displayImage`, and `permissions`.
- `isNewSignup`: Boolean indicating if this is the user's first time authorizing this app.

---

## 4. Internal Application Integration

Internal applications use different methods to obtain and verify session information based on their domain.

### Obtaining Session Information
- **Same Domain (`neupgroup.com`)**: Session information is automatically available via secure HTTP-only cookies (`auth_account_id`, `auth_session_id`, `auth_session_key`).
- **Different Domain**: Internal apps must use the `POST https://neupgroup.com/account/bridge/api.v1/auth/sign` endpoint to obtain session details, similar to external apps.

### High-Performance Verification (gRPC)
Internal applications **do not** use REST endpoints for session verification. Instead, they use **gRPC** for maximum performance and low latency.

**gRPC Service Definition:**
The `AuthService` provides a `VerifySession` method:
```proto
service AuthService {
  rpc VerifySession (VerifyRequest) returns (VerifyResponse);
}
```

---

## 5. Signout Implementation

When a user logs out from your application, notify Neup.Account to revoke the mapping.

**Endpoint:** `POST https://neupgroup.com/account/bridge/api.v1/auth/signout`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "sessionValue": "YOUR_APP_SESSION_TOKEN"
}
```

---

## 6. Cryptography and Session Security

To prevent users from manually modifying their permissions in `sessionStorage`, Neup.Account uses an asymmetric cryptographic signing mechanism.

### Key Components
- **RSA-2048 Key Pair**:
  - **Private Key (Server-Side)**: Used to create digital signatures for permission sets.
  - **Public Key (Client-Side)**: Hardcoded in the frontend to verify signatures.
- **Digital Signatures (RSA-SHA256)**: The server generates a cryptographic hash of the permissions and signs it with the Private Key, providing integrity and authenticity.

### Security Flow
1. **Signing**: The server fetches permissions, stringifies them, signs them with the Private Key, and returns a base64-encoded payload (`data` and `signature`).
2. **Verification**: The `SessionProvider` uses the pinned Public Key to verify the signature against the data using `window.crypto.subtle`.
3. **Protection**: If tampering is detected, the application rejects the cached session and initiates a fresh request to the server.

---

## 7. Data Persistence Requirements (Mandatory)

All applications (Internal & External) **must** maintain a local copy of core user data to ensure resilience.

### Required Fields
- `account_id`: (Primary Key/Unique) The Neup `accountId`.
- `display_name`: The user's chosen display name.
- `display_image`: URL to the user's profile photo.
- `neup_id`: The unique Neup identity string.

### Example Database Schema (PostgreSQL)
```sql
CREATE TABLE users (
    account_id VARCHAR(255) PRIMARY KEY, -- Neup accountId
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Security Best Practices

- **Server-to-Server Only**: All calls to the bridge API (`/sign`, `/signout`) **must** be performed from your server.
- **Session Cascading**: If a user logs out of Neup.Account, all associated `sessionValue` tokens are automatically revoked.
- **Token Storage**: Store the `sessionValue` securely (e.g., in an HTTP-only cookie).
- **Public Key Pinning**: The application ignores stored keys in `sessionStorage` and always uses the hardcoded public key for verification.

---

## 9. cURL Examples

### Start Handshake (browser redirect)
```
GET https://neupgroup.com/account/bridge/handshake.v1/auth/signin?appId=app_123&auth_handler=https://yourapp.com/neup/callback
```

### Verify One-Time Key
```bash
curl -X POST https://neupgroup.com/account/bridge/api.v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"appId":"app_123","appSecret":"secret_abc","key":"one_time_key","accountId":"acct_456"}'
```

### Validate Session Triplet
```bash
curl -X POST https://neupgroup.com/account/bridge/api.v1/auth/validate-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_123","sessionKey":"key_abc","accountId":"acct_456"}'
```
