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

Internal apps should use the `internal` or `fast` `appType` for validation.

```json
{
  "appId": "YOUR_INTERNAL_APP_ID",
  "appType": "internal",
  "auth_account_id": "VALUE_FROM_COOKIE",
  "auth_session_id": "VALUE_FROM_COOKIE",
  "auth_session_key": "VALUE_FROM_COOKIE"
}
```

### Response
A successful response returns the user's core profile data:
```json
{
  "success": true,
  "user": {
    "accountId": "...",
    "displayName": "...",
    "neupId": "..."
  }
}
```

## Data Persistence & Constraints

Internal applications must maintain their own local copy of core user data to ensure performance and data integrity.

### Required Storage
Every internal app must store the following fields in its own database for every user that interacts with it:
- `userId` (mapping to Neup `accountId`)
- `displayName`
- `displayImage` (mapping to Neup `accountPhoto`)
- `neupId`

### Database Schema Guidelines

Do not rely solely on the Neup.Account endpoint for every request. Instead, use your local database as the source of truth for your app's specific data, using the `userId` as a hard constraint.

#### Recommended Table Structure (PostgreSQL Example)

```sql
-- Core User Table in your App
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neup_user_id VARCHAR(255) UNIQUE NOT NULL, -- The accountId from Neup.Account
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Use neup_user_id as a Foreign Key for your app's specific data
CREATE TABLE app_data (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
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
3. **Constraints**: Always use the `neup_user_id` as the primary identifier and constraint for all user-related data in your local schema.
