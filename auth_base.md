# Auth Base Inventory

This file lists the current auth/application access data model after consolidation into sessions.

## AuthSession / auth_session
Source of truth for internal and external app sessions.

Important fields:
- application
- applicationType (internal or external)
- applicationDomain
- authSessionKey
- permissions
- dependentKeys

Used in:
- [services/auth/access.ts](services/auth/access.ts)
- [services/auth/grant.ts](services/auth/grant.ts)
- [services/auth/permission.ts](services/auth/permission.ts)
- [services/auth/profile.ts](services/auth/profile.ts)
- [services/auth/jwt.ts](services/auth/jwt.ts)
- [services/auth/signout.ts](services/auth/signout.ts)
- [services/auth/sign.ts](services/auth/sign.ts)
- [services/data/application-access.ts](services/data/application-access.ts)
- [services/data/signed-applications.ts](services/data/signed-applications.ts)
- [services/manage/applications.ts](services/manage/applications.ts)

## ApplicationConnection / application_connection
Kept for user-to-application connection listing.

Used in:
- [services/data/applications.ts](services/data/applications.ts)

## Permission Resolution
Direct app permission tables are removed.
Permissions are resolved from portfolio membership and portfolio roles using:
- accountId
- assetType
- assetId

Primary files:
- [services/auth/permission.ts](services/auth/permission.ts)
- [core/helpers/user.ts](core/helpers/user.ts)

## Removed Tables
- auth_permission_recipients
- app_authentications
- app_sessions
