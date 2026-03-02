# Internal App Integration & SSO Guide

This guide describes how to integrate internal Neup ecosystem applications that share the same domain and leverage the same authentication cookies as Neup.Account.

## Authentication Overview (SSO)

Internal apps on the same domain (e.g., `neupgroup.com`) share the same HTTP-only authentication cookies. This allows for a seamless Single Sign-On (SSO) experience.

### Shared Credentials

When a user is logged into Neup.Account, the following cookies are available to your application:
- `auth_account_id`: The unique identifier for the user.
- `auth_session_id`: The active session identifier.
- `auth_session_key`: The cryptographic key associated with the session.

## Session Verification

To verify that the user is truly authenticated and the session is valid, your internal application must make a server-to-server request to the Neup.Account verification endpoint.

### Endpoint
`POST neupgroup.com/account/bridge/api.v1/auth/verify`

### Verification Request (Internal Flow)

Internal apps should follow a "Check then Signup" flow to optimize database operations.

1. **Local Check**: The app should first check if the `auth_account_id` from the cookie exists in its local database.
2. **Conditional Signup**: 
   - If the user exists, proceed with a normal verification.
   - If the user **does not exist**, include `"signup": true` in the verification request.

```json
{
  "appId": "YOUR_INTERNAL_APP_ID",
  "appType": "internal",
  "auth_account_id": "VALUE_FROM_COOKIE",
  "auth_session_id": "VALUE_FROM_COOKIE",
  "auth_session_key": "VALUE_FROM_COOKIE",
  "signup": true 
}
```

### Response
If `signup: true` was passed in the request, it will be echoed in the success response.

```json
{
  "success": true,
  "user": {
    "accountId": "...",
    "displayName": "...",
    "neupId": "..."
  },
  "signup": true
}
```

When the app receives `signup: true` in the response, it should immediately create the user record in its local database using the provided `user` data. This prevents redundant database checks or accidental duplicate creation attempts.

## External App Authentication (Non-shared Domain)

For applications that are **not** on the same domain (external apps), a more formal "Sign" process is required to bridge the authentication.

### The "Sign" Endpoint
`POST neupgroup.com/account/bridge/api.v1/auth/sign`

This endpoint handles both the initial app-specific "signup" (creation of `appAuthentication` record) and the generation of an external session.

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
- If the user has never used the app before, an `appAuthentication` record is created.
- A unique `sessionValue` is generated and stored in the `appSessions` table, linked to the primary NeupAccount session.
- Returns `displayName`, `displayImage`, `permissions`, `accountId`, and the `sessionValue`.

### External Signout
`POST neupgroup.com/account/bridge/api.v1/auth/signout`

External apps should call this when the user logs out from their device.
- **Request**: `{ "sessionValue": "...", "appId": "..." }`
- **Action**: Deletes the specific `appSession` record.

### Session Cascading
If a user logs out of Neup.Account or a session is expired remotely, all associated `appSession` records for that specific `sessionId` are automatically revoked.

## Data Persistence & Constraints

Internal applications must maintain their own local copy of core user data to ensure performance and data integrity.

### Required Storage
Every internal app must store the following fields in its own database for every user that interacts with it:
- `accountId` (mapping to Neup `accountId`)
- `displayName`
- `displayImage` (mapping to Neup `accountPhoto`)
- `neupId`

### Database Schema Guidelines

Do not rely solely on the Neup.Account endpoint for every request. Instead, use your local database as the source of truth for your app's specific data, using the `account_id` as a hard constraint.

#### Recommended Table Structure (PostgreSQL Example)

```sql
-- Core User Table in your App
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(255) UNIQUE NOT NULL, -- The accountId from Neup.Account
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Use neup_user_id as a Foreign Key for your app's specific data
CREATE TABLE app_data (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    content TEXT,
    CONSTRAINT fk_user 
      FOREIGN KEY(user_id) 
      REFERENCES users(neup_user_id) 
      ON DELETE CASCADE
);
```

### Synchronization Policy
1. **Initial Login**: When a user first enters your app, call the `neupgroup.com/account/bridge/api.v1/auth/verify` endpoint and create the local `users` record.
2. **Updates**: Periodically (or on every session start), refresh the `display_name` and `display_image` from the `neupgroup.com/account/bridge/api.v1/auth/verify` response to keep your local database synchronized with Neup.Account.
3. **Constraints**: Always use the `account_id` as the primary identifier and constraint for all user-related data in your local schema.
