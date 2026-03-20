# Account Database

This document explains an optional procedure for saving Neup.Account user information in the client application's own local database.

This is not required for authentication.

A client app can work without saving a local account row.

However, if the client app wants a faster system, more complex internal data structures, or a stronger internal relationship between its own records and the Neup account, it may save the account in its own database.

## Why save the account locally

Saving a local account record can help when the client app wants to:

- link internal data to a stable Neup account id
- make account lookups faster
- support more complex application logic than simple view-only access
- attach roles, projects, teams, billing records, or domain-specific data to one user
- avoid repeating the same bootstrap logic on every request

## The sign type returned by the auth flow

During the handshake flow, Neup.Account redirects back with an `authType`.

That value is:

- `signup`
- `signin`

Meaning:

- `signup`: this appears to be the first authentication for that account in this application
- `signin`: the account has already authenticated with this application before

This is useful for deciding whether the client app should create a new local account row or reuse an existing one.

## What the client app gets first

After the client app exchanges the `tempToken`, the grant response returns values such as:

- `aid`
- `sid`
- `skey`
- `jwt`
- `role`

The grant response does not need to be the only bootstrap step.

If the client app also wants profile information such as:

- `displayName`
- `neupId`
- first name
- last name

it can fetch those details in a follow-up profile/bootstrap step and then save them locally.

## Recommended bootstrap procedure

1. User completes the Neup.Account handshake.
2. Client app receives `authType` in the redirect.
3. Client app server exchanges the `tempToken` for the grant.
4. Client app reads `aid` from the grant response.
5. If needed, client app fetches profile information such as `displayName` and `neupId`.
6. Client app creates or updates a local database row keyed by `aid`.

## When `authType` is `signup`

If the client app receives `authType=signup`, that is usually the best time to create a new local account record.

Recommended behavior:

- insert a new local row keyed by `aid`
- save `displayName` and `neupId` if the app wants them
- attach any app-specific defaults
- create any related internal records the application needs

## When `authType` is `signin`

If the client app receives `authType=signin`, the app can:

- look up the local account row by `aid`
- create it only if it does not exist yet
- refresh copied profile fields if the app wants to keep them current

This makes the process resilient even if the local database was cleared or if the app is being migrated.

## Where to get `displayName` and `neupId`

If the client app wants to save more than just `aid`, it can fetch profile information after the grant step.

Common options in this repo are:

- `GET /api.v1/profile` using `tempToken` and `appId`
- `GET /api.v1/profile` using persistent external session headers

Those profile responses can include fields such as:

- `aid`
- `neupId`
- `displayName`
- `firstName`
- `middleName`
- `lastName`

So the local database procedure is usually:

1. save `aid` from the grant
2. fetch profile data if needed
3. upsert the local account row

## Minimal recommended local fields

If the client app wants a very small local account table, a minimal setup can be:

- `account_id`
- `display_name`
- `neup_id`
- `created_at`
- `updated_at`

For many systems, saving only `account_id` is already useful.

Saving `displayName` and `neupId` is optional, but it can improve user experience and make internal features easier to build.

## Suggested table example

```sql
CREATE TABLE app_accounts (
  account_id TEXT PRIMARY KEY,
  neup_id TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Example upsert logic

Pseudocode:

```ts
const grant = await exchangeGrant(tempToken);
const aid = grant.aid;

const profile = await fetchProfile({
  appId,
  tempToken,
});

await db.app_accounts.upsert({
  where: { account_id: aid },
  create: {
    account_id: aid,
    neup_id: profile.neupId,
    display_name: profile.displayName,
  },
  update: {
    neup_id: profile.neupId,
    display_name: profile.displayName,
  },
});
```

## Why this can make the system faster

Keeping a local account record can make the system easier to work with because the client app can:

- resolve its own user row quickly by `aid`
- join local business data without another bootstrap call
- keep domain-specific structures separate from auth transport logic
- build more advanced internal permission or ownership models

Again, this is not necessary.

It is simply a recommended enhancement for apps that need more than the simplest integration.

## Important reminder

Saved local account information is a cached application copy.

It should not replace live authentication.

Neup.Account remains the source of truth for authentication and core identity.

If the client app saves copied identity data, it is a good idea to combine this procedure with the recommendations in:

- `docs/auth/saving_account_information.md`

That way the app can also expose the saved copy, support updates, and keep profile fields synchronized when needed.
