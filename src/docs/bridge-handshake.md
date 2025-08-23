# Bridge Handshake Authentication Flow

The Bridge Handshake is a mechanism that allows external applications to securely authenticate a user through their active Neup.Account session. This flow ensures that only authenticated users can be passed to trusted applications with a secure, short-lived token.

## Process Overview

1.  **Initiation**: The external application (the "relying party") redirects the user to the Neup.Account handshake endpoint.
2.  **Authentication**: The Neup.Account endpoint checks if the user has an active and valid session.
3.  **Key Generation**: If the session is valid, it generates a single-use, time-limited cryptographic key (`dependentKey`). This key is stored in the user's session document in Firestore.
4.  **Browser Redirect**: The user is redirected back to the `auth_handler` URL provided by the external application, with the `key` and other session details appended as query parameters.
5.  **Backend Verification**: The external application's backend receives the redirect and makes a secure, **server-to-server API call** to Neup.Account to verify the `key`. **This step must never be done from the user's browser.**
6.  **Login**: Upon successful verification from the Neup.Account API, the external application can create its own session and log the user in.

---

## Step 1: Initiate Handshake

The external application **must** redirect the user to the following endpoint with the specified parameters:

**Endpoint**: `/bridge/handshake/auth`

| Parameter        | Type   | Required | Description                                                                                    |
|------------------|--------|----------|------------------------------------------------------------------------------------------------|
| `appId`          | string | Yes      | The unique ID of the application requesting authentication.                                    |
| `auth_handler`   | string | Yes      | The full, URL-encoded URI on your backend to handle the callback after authentication.         |
| `redirect_to`    | string | No       | An optional URL to redirect the user to after your `auth_handler` successfully logs them in.   |

### Example Request
```
https://neup.account.com/bridge/handshake/auth?appId=my-cool-app&auth_handler=https%3A%2F%2Fmy-cool-app.com%2Flogin%2Fcallback&redirect_to=%2Fdashboard
```

---

## Step 2: Handle Redirect from Neup.Account

If the user is authenticated, Neup.Account will redirect them back to your `auth_handler` URL with the following output parameters.

| Parameter     | Type   | Description                                                                          |
|---------------|--------|--------------------------------------------------------------------------------------|
| `key`         | string | A single-use cryptographic key, valid for 5 minutes.                                 |
| `session_id`  | string | The session ID from the user's Neup.Account session.                                 |
| `account_id`  | string | The user's unique Neup.Account ID.                                                   |
| `expiresOn`   | string | An ISO 8601 timestamp indicating when the `key` expires.                             |

### Example Successful Redirect
```
https://my-cool-app.com/login/callback?key=a1b2c3d4...&session_id=...&account_id=...&expiresOn=2024-01-01T12:05:00.000Z&redirect_to=%2Fdashboard
```

---

## Step 3: Verify the Key (Backend-to-Backend Only)

This is the most critical security step. Your application's **backend** must make a `POST` request to the following Neup.Account API endpoint to validate the key.

**Warning: This request must ONLY be made from your secure server environment. Never make this request from the user's browser, as it would expose your `appSecret`.**

**Endpoint**: `/bridge/api/verify-key`

### Request Body
Your backend must send a JSON body with the following fields:

| Parameter   | Type   | Required | Description                                                               |
|-------------|--------|----------|---------------------------------------------------------------------------|
| `appId`     | string | Yes      | The unique ID of your application.                                        |
| `appSecret` | string | Yes      | Your application's secret key (provided during app registration).         |
| `key`       | string | Yes      | The `key` received in the redirect from Step 2.                           |
| `accountId` | string | Yes      | The `account_id` received in the redirect from Step 2.                    |

### Successful Response (`200 OK`)
If the key is valid, you will receive a JSON response with the authenticated user's details.

```json
{
  "success": true,
  "user": {
    "accountId": "user-account-id-123",
    "displayName": "John Doe",
    "neupId": "johndoe"
  }
}
```

### Error Response (`400`, `401`, `403`, `500`)
If verification fails, you will receive a JSON response with an error message.

```json
{
  "success": false,
  "error": "Invalid or expired key."
}
```

---

## Error Handling from Step 1 Redirect

If the initial handshake fails (e.g., user is not logged in, `auth_handler` missing), the user will be redirected to an error page on Neup.Account or back to your `auth_handler` URL with error parameters.

| Parameter           | Type   | Description                                           |
|---------------------|--------|-------------------------------------------------------|
| `error`             | string | A short error code (e.g., `unauthenticated`).         |
| `error_description` | string | A human-readable explanation of the error.            |

### Example Error Redirect
```
https://my-cool-app.com/login/callback?error=unauthenticated&error_description=No+active+user+session+found.
```
