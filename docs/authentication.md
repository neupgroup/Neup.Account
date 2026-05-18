# Authentication for Other Applications

This document explains how other **client applications** (internal apps, partner apps, and third‑party apps) can authenticate users via **Neup.Account**.

If you are building a public integration, use this page to choose the right flow, then follow the linked detailed guides.

**Base URL:** `https://neupgroup.com/account`

---

## Parties


| Party | Typical meaning                       | Recommended auth flows                                                                                                              |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `1`   | First‑party internal app              | Same‑domain cookies, different‑domain internal verify, Silent SSO                                                                   |
| `2`   | Trusted partner                       | Different‑domain internal verify, Silent SSO, (optionally) Redirect handshake                                                       |
| `3`   | Third‑party app built using Neup.Site | Silent SSO (no `aid`)                                                                                                               |
| `4`   | Third party custom app                | Redirect handshake (only when you need sign‑in for first time sign in and for when there's change in policy), Silent SSO (no `aid`) |


> Note: For Party `3/4`, The account `aid` is omitted not provided to the client application. Use the **redirect handshake** when you are signing in an new user or when the policy for the app is changed.

---

## Understanding common for everything

When you get token regardless of whatever the authentication mechanism you use and regardless of the component you use. What you need to understand is that the token will be passed on to you. Token is always signed using a private key and you need to use the public key to get the data that is signed. You will use a public key to get the database if you need to process the signed data again.

The public key (the one used to get the data back from the signed version) is:

========> Start >>>>>>>
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2aPJSyu08S/7ywvvaSwz
Ett4kSQ0mU0vQe1hjmcjYCcX+FtJA82yS1bm3T2ccFc0J1B2lMr1rmMo2BM/W/pZ
ESKN2xB568lwfiuN6lGBc2j9oJaNC+65w8XEfNAKNMw2IjQA1O8o74TnQab1pUq2
rz7WdFr3F9+PRM4TeNKTv0JrnhUPl8ccrKiC4ETKbk9ryci3GsVRT5/8JWKXWW2M
/BtSM7D+1n/X+wMwNGV4wQNBXzSD8/f1caWJ6kOkUwjerwkjKSpYqZrSXv9TeZit
U16H58h/5Q6hSaBaLQ9VNyTdAFj2gdQghZnOnioG485VZKCK9PO/MZ0VPTvOavel
cQIDAQAB
-----END PUBLIC KEY-----
========> End >>>>>>>>>




## 1. Authentication using Redirect Handshake

Use this flow when your application needs to **sign a user in** to your own system by delegating authentication to Neup.Account.

This is the recommended approach for Party `4` apps (and any other public integrations) because it:

- runs the user interaction (login/consent) in the browser via redirect
- returns a short‑lived, one‑time `tempToken` to your callback
- lets your server exchange that `tempToken` for a durable external session (`sid` + `skey`)

### Prerequisites

1. You have an `appId` and `appSecret`.
2. Your callback URL is registered as an `authenticatesTo` URL for your application.
3. Your callback URL must be an absolute HTTPS URL.

### 1.1. Start the handshake (browser redirect)

Redirect the user’s browser to:

```txt
GET https://neupgroup.com/account/bridge/handshake.v1/auth/grant
  ?app=YOUR_APP_ID
  &authenticatesTo=https://yourapp.com/auth/callback
```

**Query parameters:**

- `appId` (required): your application id.
- `authenticatesTo` (required): your server callback URL (must be registered).
- Any additional query params are forwarded to your callback unchanged (except `appId` and `authenticatesTo`), so you can include your own `state`, `returnTo`, etc.

### 1.2. Receive the callback (your server)

On success, Neup.Account redirects back to your callback with:

- `tempToken` (one‑time, valid for ~5 minutes)
- `authType` (`signin` or `signup`)

Example:

```txt
https://yourapp.com/auth/callback?tempToken=TOKEN_VALUE&authType=signin
```

On failure (when Neup.Account can still redirect back to your callback), it includes:

- `error` (an error code)

Example:

```txt
https://yourapp.com/auth/callback?error=invalid_redirect
```

### 1.3. Exchange `tempToken` for an external session (server‑to‑server POST)

Exchange the token from your backend (never from browser JavaScript):

```http
POST https://neupgroup.com/account/bridge/api.v1/auth/grant
content-type: application/json

{
  "app": "YOUR_APP_ID",
  "tempToken": "TOKEN_FROM_CALLBACK"
}
```

**Response (200)** includes:

```
{
    "success" : true,
    "token" : jwt([cid:cid, aid:aid, type:type iat:iat, refreshesOn:time exp:exp, role:role]) -> as defined in the token response.
    "response" : {as defined in api response fields}
}
```

**Invalid Response 400,401** will be in this format.

```
{
    "success" : false,
    "error" : "invalid_request"
}
```

### 1.4. Store the external session on your side

Recommended:

- Store the token in the cookie scoped to your domain. 
- Example, Save the cookie as `auth_account` variable.

Do not expose then token jwt to the browser JavaScript.

### 1.5. Validate an existing external session (server‑to‑server)

Do this when required like changing the passwords and so more.

```txt
POST https://neupgroup.com/account/bridge/api.v1/auth/validate
content-type: application/json

{  
  token: auth_account jwt value -> as defined in the token response
}
```

**Response (200):** `{ success: true }`  
**Response (401):** `{ success: false, error: invalid_grant }` when the grant is missing or expired.

### 1.6. Refresh the external session (server‑to‑server PATCH)

Refreshing extends the session by 7 minutes if the token has not expired. The token should not after the refreshesOn time, but the sid, skey can be used to generate the token. if the expiresOn has been reached, we need to run the handshake redirection auth once again.

```plaintext
PATCH https://neupgroup.com/account/bridge/api.v1/auth/grant
content-type: application/json

{
  token: auth_account jwt value -> as defined in the token response
}
```

**Response (200):** 

```plaintext
{
    "success" : true,
    "token" : jwt([cid:cid, aid:aid, type:type iat:iat, refreshesOn:time exp:exp, role:role]) -> as defined in the token response.
}
```

**Response (401)**

```plaintext
{
    "success" : false,
    "error" : error
}

```

---

## 2. Authenticatication using Cookies (SameDomain)

This will help you in understanding how to do the same domain authentication. Generally applicable for applications inside the neupgroup.com's domain or for application at the neupgroup.com

### 2.1. Get the `auth_account` Cookie

Get the auth_account cookie and then we go to the next step.

### 2.2. Check the Account existence in the Application (if not exists)

Run a check on the local database for the account, if the account is created, and the status is not `active` or does not exists:

```plaintext
POST https://neupgroup.com/account/bridge/api.v1/auth/register?app=[id]
content-type: application/json

{
  token: auth_account cookie value
}
```

Then it will respond with the following:

```plaintext
{
  status: true/false
  response: {as defined in the api response variables}
}

// This endpoint will not return the token because this is specifically for the internal use only and in the same domain.
```

### 2.2. Check the Account existence in the Application (if exists)

Run a check on the account module and validate the authentication status:

```plaintext
POST https://neupgroup.com/account/bridge/api.v1/auth/validate
content-type: application/json

{
  app: appId,
  token: auth_account cookie value
}
```

The app should check the token and ensure its validity. And, if valid it should return:

```plaintext
{
  valid: true
}
```

If the session has been expired, or the token has been tampered, we show:

```plaintext
{
  valid: false,
  reason: expired/tampered/session_signedOut
}
```

---

## 3. Authentication using POST Message in Browser.

Use this when you want **silent SSO** in the browser (no redirect): your app loads a hidden Neup.Account iframe and receives the auth result via `window.postMessage`.

- This approach of authentication can be used by any application, but there's a condition. This approach can only be used by application or elements that are made specifically by NeupGroup or verified by NeupGroup.

### 3.1. Prerequisites

1. The App is registered in the NeupAccount and you have appId.
2. Your app’s HTTPS origin is registered as a **Silent SSO Origin** for that `appId`.
  - Only `scheme://host` is matched (paths are ignored).
  - Origins must be HTTPS.

### 3.2. Embed the hidden iframe

Add this anywhere on pages where you want to silently check auth:

```html
<iframe
  src="https://neupgroup.com/account/bridge/silent.v1/whoisthis?app=YOUR_APP_ID"
  style="display:none;width:0;height:0;border:0"
  id="neupidSilentAuthFrame"
></iframe>
```

The iframe returns `200` even on “not signed in”. The result is communicated via `postMessage`.

### 3.3. Listen for the `postMessage`

Your app must:

- verify `event.origin === 'https://neupgroup.com'`
- verify `event.data.type === 'neupid:silentAuth'` 

`token.cid`, `token.iat`, `token.exp` will always be present and will be the identifier for the connection between the user and your app. the iat is the issuance datetime, and the exp is the tokens expiry.

```js
const NEUP_ORIGIN = 'https://neupgroup.com';

window.addEventListener('message', (event) => {
  if (event.origin !== NEUP_ORIGIN) return;

  const { type, success, token, response, reason } = event.data ?? {};
  if (type !== 'neupid:silentAuth') return;

  if (success) {
    // User has either signedin, been assigned guest.
    // token: { cid, iat, exp } -> only the cid, iat, exp will be provided in this method of auth.
    // response: flat key→value map (name.display, contact.email, account.type, ...)
    //
    console.log('Authenticated:', token, response);
  } else {
    // Blocked (origin not registered, rate limited, etc.)
    console.log('Not authenticated:', reason);
  }
});
```

### 3.4. Token expiry and refresh

`token.exp` is a Unix timestamp. When it expires, simply **reload the iframe** to receive a fresh token. Do not treat the iframe token as your only durable session. Use it to just identify the users in the site and as a way for analytics powering engine by NeupGroup.

---

## 4. Signout guidance

To sign the user out of your app, the step 1 would be to make this request, this is for the Neup.Group's application.

```plaintext
POST https://neupgroup.com/account/bridge/api.v1/auth/expire
Content-Type: JSON/Application

{
  token: token from cookies
}
```

For other secondary applications who logged in using the handshake authentication:

```plaintext
POST https://neupgroup.com/account/bridge/api.v1/auth/expire?app=[appid]
Content-Type: JSON/Application

{
  token: token from cookies
}
```

This will simply have a new parameter in the url called as `?app=[id]` and this will logout the user. Then the next thing to do would be to delete the cookies from the browser. And done the signout system is done. Then redirect the user back to the authentication page.

> this approach of signout is not applicable to the POST Message by browser or the hidden iframe approach of identification.

---

## 5. Other Systems

Follow along for the other systems.