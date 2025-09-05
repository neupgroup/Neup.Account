
# Bridge Handshake Authentication Flow

The Bridge Handshake is a mechanism that allows external applications to securely authenticate a user through their active Neup.Account session. This flow ensures that only authenticated users can be passed to trusted applications with a secure, short-lived token.

## Process Overview

1.  **Initiation**: The external application redirects the user to the Neup.Account handshake endpoint.
2.  **Authentication**: Neup.Account checks if the user has an active session.
3.  **Key Generation**: If the session is valid, it generates a single-use, time-limited cryptographic key (`dependentKey`).
4.  **Browser Redirect**: The user is redirected back to the `auth_handler` URL provided by the external application, with the `key` and other session details appended as query parameters.
5.  **Backend Verification**: The external application's backend makes a secure, **server-to-server API call** to Neup.Account to verify the `key`. **This step must never be done from the user's browser.**
6.  **Login**: Upon successful verification, the external application can create its own session and log the user in.

---

## Step 1: Initiate Handshake

The external application **must** redirect the user to the following endpoint with the specified parameters:

**Endpoint**: `/bridge/handshake/auth/signin`

| Parameter        | Type   | Required | Description                                                                                    |
|------------------|--------|----------|------------------------------------------------------------------------------------------------|
| `appId`          | string | Yes      | The unique ID of the application requesting authentication.                                    |
| `auth_handler`   | string | Yes      | The full, URL-encoded URI on your backend to handle the callback after authentication.         |
| `...`            | any    | No       | Any other custom parameters (e.g., `redirect_to`) will be preserved and passed back to your `auth_handler`. |

### Example Request
```
https://neup.account.com/bridge/handshake/auth/signin?appId=my-cool-app&auth_handler=https%3A%2F%2Fmy-cool-app.com%2Flogin%2Fcallback&redirect_to=%2Fdashboard
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
https://my-cool-app.com/login/callback?key=a1b2c3d4...&session_id=...&account_id=...&expiresOn=...&redirect_to=%2Fdashboard
```

---

## Step 3: Verify the Key (Backend-to-Backend Only)

This is the most critical security step. Your application's **backend** must make a `POST` request to the following Neup.Account API endpoint to validate the key.

**Warning: This request must ONLY be made from your secure server environment. Never make this request from the user's browser, as it would expose your `appSecret`.**

**As a best practice, store your application's secret key and other credentials in environment variables (e.g., in a `.env` file) or a secure key storage service, rather than hardcoding them in your application. For example:**
- `NEUP_APP_ID=my-cool-app`
- `NEUP_APP_SECRET=your_super_secret_key_here`
- `NEUP_ACCOUNT_API_URL=https://neup.account.com`


**Endpoint**: `/bridge/api/auth/verify`

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

## Step 4: Application Logout (Optional)

To log a user out from just your application without ending their main Neup.Account session, redirect them to this endpoint. This invalidates all keys for your `appId`.

**Endpoint**: `/bridge/handshake/auth/signout`

| Parameter                   | Type   | Required | Description                                                               |
|-----------------------------|--------|----------|---------------------------------------------------------------------------|
| `appId`                     | string | Yes      | The unique ID of your application.                                        |
| `post_logout_redirect_uri`  | string | Yes      | The URL to redirect the user back to after the logout is complete.        |
