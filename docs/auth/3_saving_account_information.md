# Saving Account Information

This is optional.

A client app does not need to store Neup.Account profile data in order to use authentication.

If the client app feels that saving basic account information such as the user's names or `neupId` would help its own product, it may store that data in its own database for internal use.

## What may be saved

A client app may choose to save information such as:

- account id
- `neupId`
- display name
- first name
- middle name
- last name
- date of birth
- gender
- profile image

The client app should decide its own schema and only store the fields it actually needs.

## Important rule

If the client app saves profile data fetched from Neup.Account, it should also expose a read endpoint that returns the saved copy of that data.

This helps with:

- security review
- user visibility
- account auditing
- checking what information has been copied into the client app

These routes are recommendations for the client app to implement.
They are not mandatory for authentication, and they are not automatically created by this repo.

## 1. Read endpoint for saved account information

Purpose:

- lets Neup.Account fetch the stored profile fields that the client app has copied
- lets the user see what profile information the client app currently holds

Recommended behavior:

- authenticate the request from Neup.Account
- return only data that originally came from Neup.Account or derived display-safe metadata
- do not mix this response with unrelated private app-only business data

Recommended response example:

```json
{
  "success": true,
  "account": {
    "aid": "acct_123",
    "neupId": "jane.doe",
    "displayName": "Jane Doe",
    "firstName": "Jane",
    "middleName": "",
    "lastName": "Doe",
    "dateOfBirth": "1998-02-10",
    "gender": "female",
    "profileImage": "https://example.com/avatar.jpg",
    "updatedAt": "2026-03-20T08:00:00.000Z"
  }
}
```

## 2. Update endpoint for saved account information

This can also be added if the client app wants a standard way for Neup.Account to request profile sync updates.

Purpose:

- allows Neup.Account to tell the client app that stored account information should be updated
- reduces stale names, usernames, and other copied profile fields

Recommended behavior:

- authenticate the request from Neup.Account
- update only the fields the client app has chosen to store
- keep an audit trail if the client app needs traceability

Recommended request example:

```json
{
  "aid": "acct_123",
  "updates": {
    "neupId": "jane.doe",
    "displayName": "Jane Doe",
    "firstName": "Jane",
    "lastName": "Doe",
    "dateOfBirth": "1998-02-10",
    "gender": "female"
  },
  "reason": "profile_changed_on_neup_account"
}
```

Recommended response example:

```json
{
  "success": true
}
```

## Webhook updates

If the second party application supports webhooks, it can receive change notifications when core account information changes on Neup.Account.

Useful profile-change events include:

- name changed
- display name changed
- username or `neupId` changed
- date of birth changed
- gender changed

This helps the client app keep its saved copy aligned with the source of truth.

## Recommended webhook payload

```json
{
  "type": "account.profile.updated",
  "aid": "acct_123",
  "changedFields": [
    "displayName",
    "neupId",
    "dateOfBirth"
  ],
  "timestamp": "2026-03-20T08:00:00.000Z"
}
```

The webhook may either:

- include the changed field values directly
- or notify the client app to call its update or sync process

## Recommended sync model

If the client app stores Neup.Account profile data, a good pattern is:

1. save only the fields the app actually needs
2. expose a `GET` endpoint that returns the saved copy
3. optionally expose an update endpoint for sync requests
4. optionally register a webhook endpoint to receive profile change notifications

## Privacy guidance

This saved account information should be used only for the client app's legitimate product and security needs.

It should not be copied more broadly than necessary.

If the client app shows the user what information it has saved, that improves transparency and makes the integration safer.

## Security guidance

- authenticate all read and update requests from Neup.Account
- never treat copied profile data as a replacement for live authentication
- return only the fields that are safe and relevant to this integration
- keep logs for update requests and webhook deliveries if auditability matters
- avoid storing fields the client app does not actually need

## Suggested table example

This is only an example. Client apps should design their own schema.

```sql
CREATE TABLE saved_neup_accounts (
  account_id TEXT PRIMARY KEY,
  neup_id TEXT,
  display_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  profile_image TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Recommended rule

If a client app saves names, `neupId`, or other account information fetched from Neup.Account, it should also provide:

- a `GET` endpoint to show the saved copy
- optionally an update endpoint for synchronization
- optionally webhook support for profile change notifications

This keeps the integration more transparent, more secure, and easier for the user to understand.
