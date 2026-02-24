# Neup.Account Integration Guide

This guide explains how external applications integrate with Neup.Account for authentication and session validation.

Note: In production, a base path may be applied (e.g., `/account`). Prefix endpoints accordingly if your deployment uses a base path.

## Authentication Flow (Handshake)

- Endpoint: `GET /bridge/handshake/auth/signin`
- Purpose: Start a user authentication handshake from your app.
- Required query params:
  - `appId`: Your application ID registered with Neup.
  - `auth_handler`: Your server callback URL that receives the one-time key after the user signs in.
- Optional query params:
  - Any additional parameters you include will be forwarded to your `auth_handler` unchanged.

### How it works
- If the user is not signed in, they are redirected to `/auth/start?redirects=…`.
- After successful sign-in, the handshake redirects the user to your `auth_handler` and appends:
  - `key`: A short-lived, one-time key (5 minutes) for server-to-server verification.
  - `session_id`: The user’s session ID in Neup.Account.
  - `account_id`: The authenticated user’s account ID.
  - `expiresOn`: The key’s expiration timestamp in ISO format.
- Your app server must then verify the key via the verification API below before granting access.

### Example
```
GET /bridge/handshake/auth/signin?appId=YOUR_APP_ID&auth_handler=https://yourapp.com/neup/callback&state=xyz
```
After sign-in, you will receive a redirect to:
```
https://yourapp.com/neup/callback?state=xyz&key=ONE_TIME_KEY&session_id=SESSION_ID&account_id=ACCOUNT_ID&expiresOn=ISO_DATE
```

## Verify One-Time Key (Server-to-Server)

- Endpoint: `POST /bridge/api/auth/verify`
- Purpose: Validate the one-time `key` and retrieve minimal user info.
- Body (JSON):
```json
{
  "appId": "YOUR_APP_ID",
  "appSecret": "YOUR_APP_SECRET",
  "key": "ONE_TIME_KEY",
  "accountId": "ACCOUNT_ID"
}
```
- Success response:
```json
{
  "success": true,
  "user": {
    "accountId": "ACCOUNT_ID",
    "displayName": "Display Name",
    "neupId": "neupid-or-null"
  }
}
```
- Failure response:
```json
{ "success": false, "error": "reason" }
```
- Notes:
  - The API also marks the `key` as used to prevent replay attacks.
  - The `appId` and `appSecret` must match a registered application.

## Validate Session Triplet (First-Party/Trusted)

For first-party or trusted apps that directly store session details, you can validate the session triplet.

- Endpoint: `POST /bridge/api/auth/validate-session`
- Purpose: Verify an existing session using `sessionId`, `sessionKey`, and `accountId`.
- Body (JSON):
```json
{
  "sessionId": "SESSION_ID",
  "sessionKey": "SESSION_KEY",
  "accountId": "ACCOUNT_ID"
}
```
- Success response:
```json
{
  "success": true,
  "session": {
    "accountId": "ACCOUNT_ID",
    "sessionId": "SESSION_ID",
    "expiresOn": "ISO_DATE"
  }
}
```
- Failure response:
```json
{ "success": false, "error": "Invalid or expired session." }
```
- Notes:
  - Use this only if you securely received and stored session details.
  - For third-party apps, prefer the One-Time Key verification above.

## Sign Out (Optional)

- Endpoint: `GET /bridge/handshake/auth/signout`
- Purpose: Mark a previously issued dependent key as used and redirect back to your app.
- Query params:
  - `appId`: Your application ID.
  - `post_logout_redirect_uri`: Where to send the user after sign out.

## Client Redirect Behavior

- Unauthenticated users attempting to access protected routes are redirected to:
  - `/auth/start?redirects={ENCODED_ATTEMPTED_URL}&…otherOriginalQueryParams`
- After completing sign-in, users are returned to the original URL preserved in `redirects`.

## Security Notes

- The One-Time Key returned to `auth_handler`:
  - Expires in 5 minutes.
  - Can only be used once; verification marks it as used.
- Do not use session cookies across domains. External apps must verify via the One-Time Key.
- Keep `appSecret` confidential and never expose it in client-side code.

## cURL Examples

- Start Handshake (browser redirect):
```
GET /bridge/handshake/auth/signin?appId=app_123&auth_handler=https://yourapp.com/neup/callback
```

- Verify One-Time Key:
```bash
curl -X POST https://your-neup-host/bridge/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"appId":"app_123","appSecret":"secret_abc","key":"one_time_key","accountId":"acct_456"}'
```

- Validate Session Triplet:
```bash
curl -X POST https://your-neup-host/bridge/api/auth/validate-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_123","sessionKey":"key_abc","accountId":"acct_456"}'
```

