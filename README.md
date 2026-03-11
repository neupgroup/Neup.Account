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
- **Endpoint**: `GET /bridge/handshake.v1/auth/grant`
- **Purpose**: Starts the signing flow and redirects to Neup.Account for authentication.
- **Required query params**:
  - `appId`: Your application ID (encoded in public key).
  - `redirectsTo`: Your server callback URL.
- **Optional query params**: Any additional parameters will be forwarded to your `redirectsTo` unchanged.

### How it works
1. If the user is not signed in, they are redirected to `/auth/start?redirects=…`.
2. After successful sign-in, the handshake redirects the user to your `redirectsTo` URL and appends:
   - `tempToken`: A short-lived, one-time token (5 minutes) for server-to-server verification.
   - `authType`: Either `signin` (existing user) or `signup` (new user for this app).
3. Your app server must then verify the `tempToken` via the verification API before granting access.

**Example Request:**
```
GET https://neupgroup.com/account/bridge/handshake.v1/auth/grant?appId=YOUR_APP_ID&redirectsTo=https://yourapp.com/auth/callback&state=xyz
```

**Example Redirect:**
```
https://yourapp.com/auth/callback?state=xyz&tempToken=TOKEN_VALUE&authType=signin
```

---

## 3. External Application Integration

External applications interact with Neup.Account primarily through the **"Sign"** endpoint.

### The "Grant" Process (Exchange tempToken for Session)
External apps perform a POST request to exchange the `tempToken` (received via the handshake) for a persistent session and a signed JWT.

**Endpoint:** `POST https://neupgroup.com/account/api.v1/auth/grant`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "tempToken": "TOKEN_FROM_HANDSHAKE"
}
```

**Response Properties:**
- `aid`: The Neup `accountId`.
- `sid`: A unique session ID for the external app. (Expires in 7 days)
- `skey`: A secure session key for the external app. (Expires in 7 days)
- `jwt`: A signed JSON Web Token containing user identity and roles. (Expires in 7 minutes)
- `exp`: Expiration timestamp (Unix seconds) for the **JWT token** only.
- `role`: The user's assigned role for this application.
- `per`: (Optional) Array of permissions, included if the role has "extra" permissions enabled.

**JWT Payload:**
```json
{
  "aid": "123",
  "role": "role-name",
  "per": ["perm1", "perm2"], // Included if hasExtra is true
  "iat": 123123123,
  "exp": 234234234 // Exactly 7 minutes after iat
}
```

---

### The "Refresh" Process (Renew Session & JWT)
External apps perform a PATCH request to extend the session's expiry (sid, aid, skey) and obtain a new JWT token. 

- **Session Expiry**: Extended to 7 days from the time of refresh.
- **JWT Expiry**: A new JWT is issued with a 7-minute lifetime.

**Endpoint:** `PATCH https://neupgroup.com/account/api.v1/auth/grant`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "aid": "USER_ACCOUNT_ID",
  "sid": "EXTERNAL_SESSION_ID",
  "skey": "EXTERNAL_SESSION_KEY"
}
```

**Response Properties:**
- `aid`: The user's account ID.
- `sid`: The session ID.
- `jwt`: A fresh signed JWT token (expires in 7 minutes).
- `exp`: New expiration timestamp (Unix seconds).
- `role`: The user's role.
- `per`: (Optional) User permissions.

---

### The "Access" Process (Server-Side Permission Check)
External applications can verify if a user has a specific permission for an activity. This check **must** be performed from the client application's server-side.

**Endpoint:** `GET https://neupgroup.com/account/bridge/api.v1/auth/access`

**Required Query Parameters:**
- `aid`: The user's account ID.
- `sid`: The user's external session ID.
- `skey`: The user's external session key.
- `permission_required`: The string identifier of the permission to check.

**Optional Query Parameters:**
- `appId`: Your application ID (can be inferred from `sid`).

**Response Body:**
```json
{
  "aid": "123",
  "appId": "app_123",
  "permission_required": "read:profile",
  "allowed": true,
  "timestamp": "2024-03-12T12:00:00.000Z"
}
```

---

## 4. User Profile & Data Sharing

Applications can retrieve user profile information using the `profile` endpoint. This endpoint supports both persistent session authentication and one-time `tempToken` authentication.

### Get User Profile
Retrieves user information based on the level of access granted.

- **Endpoint**: `GET /api.v1/profile`
- **Authentication**:
  - **Option A (Persistent Session)**: Pass `aid`, `sid`, and `skey` in the request headers.
  - **Option B (One-time Grant)**: Pass `tempToken` and `appId` as query parameters.

**Request Headers (Option A):**
```http
aid: USER_ACCOUNT_ID
sid: EXTERNAL_SESSION_ID
skey: EXTERNAL_SESSION_KEY
```

**Query Parameters (Option B):**
- `tempToken`: The token received from the handshake.
- `appId`: Your application ID.

**Query Parameters (Optional for both):**
- `aid`: The account ID of the user whose profile you want to fetch.
- `neupid`: The NeupID of the user whose profile you want to fetch.

**Privacy Logic:**
- **Self/Authenticated User**: Returns full profile details (emails, phones, DOB, gender, nationality, etc.).
- **Other Users**: Returns limited public information (`displayName`, `displayImage`, `verified`, `accountType`).

**Example Response (Full Profile):**
```json
{
  "success": true,
  "profile": {
    "aid": "acc_123",
    "neupId": "user.name",
    "displayName": "John Doe",
    "displayImage": "https://...",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "male",
    "dob": "1990-01-01T00:00:00.000Z",
    "emails": ["john@example.com"],
    "phones": ["+123456789"],
    "verified": true,
    "accountType": "individual"
  }
}
```

---

## 5. Internal Application Integration

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

## 6. Signout Implementation

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

## 7. Cryptography and Session Security

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

## 8. Data Persistence Requirements (Mandatory)

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

## 9. Security Best Practices

- **Server-to-Server Only**: All calls to the bridge API (`/sign`, `/signout`) **must** be performed from your server.
- **Session Cascading**: If a user logs out of Neup.Account, all associated `sessionValue` tokens are automatically revoked.
- **Token Storage**: Store the `sessionValue` securely (e.g., in an HTTP-only cookie).
- **Public Key Pinning**: The application ignores stored keys in `sessionStorage` and always uses the hardcoded public key for verification.

---

## 10. cURL Examples

### Start Handshake (browser redirect)
```
GET https://neupgroup.com/account/bridge/handshake.v1/auth/grant?appId=app_123&redirectsTo=https://yourapp.com/neup/callback
```

### Verify tempToken (External Apps)
```bash
curl -X POST https://neupgroup.com/account/bridge/api.v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_123",
    "appSecret": "secret_abc",
    "key": "tempToken_value",
    "accountId": "acct_456"
  }'
```

### Verify Session Triplet (Internal/Fast Apps)
```bash
curl -X POST https://neupgroup.com/account/bridge/api.v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_123",
    "appType": "internal",
    "auth_account_id": "acct_456",
    "auth_session_id": "sess_123",
    "auth_session_key": "key_abc"
  }'
```
