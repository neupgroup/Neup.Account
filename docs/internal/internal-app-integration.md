# Neup.Account Integration & SSO Guide

This guide describes how to integrate both **Internal** (same domain) and **External** (different domain) applications into the Neup ecosystem.

---

## 1. Internal Applications (Same Domain)

Internal applications residing on the same domain (e.g., `app.neupgroup.com`) share the same HTTP-only authentication cookies as Neup.Account.

### Shared Credentials
When a user is logged into Neup.Account, your application can access:
- `auth_account_id`: The unique user identifier.
- `auth_session_id`: The active session identifier.
- `auth_session_key`: The cryptographic key for the session.

### Verification Flow (Check then Signup)
To optimize performance and database operations, internal apps should follow this strategy:

1.  **Local Check**: Before calling the API, check if the `auth_account_id` already exists in your local database.
2.  **Conditional Verification**:
    - **If user exists**: Call `/verify` normally to ensure the session is still active.
    - **If user is missing**: Call `/verify` with `"signup": true`.

**Endpoint:** `POST neupgroup.com/account/bridge/api.v1/auth/verify`

**Request Body:**
```json
{
  "appId": "YOUR_INTERNAL_APP_ID",
  "appType": "internal",
  "auth_account_id": "...",
  "auth_session_id": "...",
  "auth_session_key": "...",
  "signup": true 
}
```

**Response:**
If `signup: true` is returned, immediately create the local user record using the provided `user` data (`accountId`, `displayName`, `neupId`).

---

## 2. External Applications (Different Domain)

External applications (different domain or third-party) do **not** have access to shared cookies. They must use the "Sign" process to bridge authentication.

### The "Sign" Process
External apps must receive the `auth_*` credentials (usually via a redirect or secure handshake) and then exchange them for an app-specific session.

**Endpoint:** `POST neupgroup.com/account/bridge/api.v1/auth/sign`

**Request Body:**
```json
{
  "appId": "YOUR_EXTERNAL_APP_ID",
  "appType": "external",
  "auth_account_id": "...",
  "auth_session_id": "...",
  "auth_session_key": "..."
}
```

**Response:**
- **Account Creation**: If the user hasn't authorized the app before, an `AppAuthentication` record is created automatically.
- **App Session**: A unique `sessionValue` is generated. This is the token the external app should use for its own session management.
- **User Data**: Returns `displayName`, `displayImage`, `permissions`, and `accountId`.

### External Signout
When a user logs out from the external app's interface, the app must notify Neup.Account to revoke the mapping.

**Endpoint:** `POST neupgroup.com/account/bridge/api.v1/auth/signout`
**Request:** `{ "sessionValue": "...", "appId": "..." }`

### Session Cascading (Security)
If a user logs out of Neup.Account directly (or their session is remotely terminated), Neup.Account automatically revokes all associated `sessionValue` mappings for that user across all external apps.

---

## 3. Data Persistence & Constraints (Mandatory)

Regardless of app type, you **must** maintain a local copy of core user data to ensure your app functions correctly even if the account service is temporarily unreachable.

### Required Fields
- `account_id`: (Primary Key/Unique) The Neup `accountId`.
- `display_name`: Cached name.
- `display_image`: Cached photo URL.
- `neup_id`: The user's Neup identity string.

### Recommended Schema (PostgreSQL)

```sql
-- Core User Table
CREATE TABLE users (
    account_id VARCHAR(255) PRIMARY KEY, -- Neup accountId
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- App Specific Data
CREATE TABLE app_features (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    feature_data JSONB,
    CONSTRAINT fk_user 
      FOREIGN KEY(account_id) 
      REFERENCES users(account_id) 
      ON DELETE CASCADE
);
```

### Best Practices
1.  **Hard Constraints**: Always use `account_id` as a foreign key for your app's data. This ensures that data is deleted if the user is removed from your app.
2.  **Periodic Refresh**: Update `display_name` and `display_image` whenever a user starts a new session to keep your local database synchronized.
3.  **Trust the Sign/Verify**: Only create or update local records after a successful response from the Neup.Account bridge.
