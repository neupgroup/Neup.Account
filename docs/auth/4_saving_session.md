# Saving Session Information

This is completely optional.

An application does not need to implement this in order to use Neup.Account authentication.

If the client application wants better session visibility and remote logout support, we recommend the following pattern.

## Recommendation

If your app saves session information after sign-in, save it in your own database table in whatever structure fits your system.

For example, after exchanging a `tempToken` or verifying an internal session, your app may choose to store:

- the Neup account id
- your local session id
- your local refresh token or session token
- device name
- browser or platform
- IP or coarse location if you already collect it
- created time
- last active time
- any other user-visible session metadata

Neup.Account does not require a fixed schema for this.

## Why save it

Saving app-side sessions can help with:

- showing users where they are logged in
- allowing remote logout from Neup.Account without opening the client app
- making it easier for the client app to manage active devices

## Recommended extra integration

If the client app is saving sessions in its own database, we recommend exposing two app-owned endpoints:

1. a logout webhook that Neup.Account can call
2. a session listing endpoint that Neup.Account can call

These routes are for the client app to implement.
They are not required for authentication, and they are not currently provided automatically by this repo.

## 1. Logout webhook

Purpose:

- lets Neup.Account ask the client app to log out one specific session
- lets the user revoke access from Neup.Account without opening the client app

Recommended behavior:

- authenticate the request from Neup.Account
- locate the app-side session
- invalidate it in the client app database
- clear any related tokens or refresh records
- return a simple success response

Recommended request shape:

```json
{
  "aid": "NEUP_ACCOUNT_ID",
  "appId": "CLIENT_APP_ID",
  "sessionId": "CLIENT_APP_SESSION_ID",
  "reason": "user_requested_remote_logout"
}
```

Recommended response shape:

```json
{
  "success": true
}
```

If your app prefers, you can use your own session identifier instead of exposing Neup session ids directly.

## 2. Session listing endpoint

Purpose:

- lets Neup.Account fetch basic session information for display to the user
- gives the user a way to review and revoke active sessions from one place

Recommended behavior:

- authenticate the request from Neup.Account
- return only user-visible session basics
- avoid returning secrets, refresh tokens, or internal signing material

Recommended response fields:

- app session id
- signed-in account id
- device name
- platform or browser name
- approximate location if your app already stores it
- created at
- last active at
- current status
- any extra display-safe metadata the client app wants to share

Example response:

```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "sess_app_123",
      "aid": "acct_123",
      "deviceName": "MacBook Pro",
      "platform": "Chrome on macOS",
      "location": "Kathmandu, NP",
      "createdAt": "2026-03-20T07:00:00.000Z",
      "lastActiveAt": "2026-03-20T08:00:00.000Z",
      "status": "active"
    }
  ]
}
```

## Privacy note

Neup.Account should use this session information only to help the user manage sessions.

It should not be used for:

- analytics
- ad targeting
- unrelated tracking
- behavioral profiling

The point of this integration is user control, not data collection.

## Security notes

- never return raw session secrets in the listing endpoint
- keep logout requests authenticated and signed
- log webhook calls for audit purposes
- let the client app decide how much display-safe metadata it wants to share
- if location is shared, prefer coarse location over precise tracking

## Suggested schema example

This is only an example. Client apps should design their own table as needed.

```sql
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  local_user_id TEXT,
  device_name TEXT,
  platform TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
);
```

## Recommended rule

If your app stores sessions, it is a good idea to also expose:

- a safe way for Neup.Account to list them
- a safe way for Neup.Account to revoke them

This makes session management better for users, while staying fully optional for the client app.
