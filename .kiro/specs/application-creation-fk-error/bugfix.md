# Bugfix Requirements Document

## Introduction

When a user submits the "Add Application" form (POST `/data/applications/add`), the `createManagedApplication` server action fails with a Prisma foreign key constraint violation:

```
PrismaClientKnownRequestError:
  Invalid `prisma.authzAccountAccessGrant.create()` invocation:
  Foreign key constraint violated on the constraint: `authz_account_access_grant_role_id_fkey`
```

### Root Cause

The real root cause is that the codebase is mid-migration from the legacy `permit` table to the new `authz_*` tables (`authz_account_access_grant`, `authz_assets_access_grant`, `authz_role`, `authz_role_capability`, `authz_capability`). The `createManagedApplication` action already uses the new tables, but the `application.owner` role it references in `authz_role` is only created by an optional seed script (`prisma/02_neupaccount_applicationRole.ts`). If that seed hasn't been run, the FK constraint fires.

Additionally, many other parts of the application still use the old `permit` table for two distinct purposes:

1. **Account-level delegation** — tracking which accounts a user can switch into (used in `accessible.ts`, `switch.ts`, `access/index.ts`, `invitations.ts`, `dependent.ts`)
2. **Permission/capability storage** — storing per-account permission strings (used in `users.ts`, `seed.ts`, `grant-root.ts`)

The `checkPermissions()` function in `services/user.ts` already reads from the new `authz_account_access_grant` + `authz_role_capability` tables. The `permit` table is now a dead-end for permission resolution — it is written to but never read by the active permission-checking path.

The fix has two parts:
1. **Immediate fix**: Ensure the `application.owner` role exists before the grants are created (upsert it inside the transaction).
2. **Migration**: Replace all remaining `prisma.permit.*` usages with the appropriate new-model equivalents.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits the "Add Application" form and the `application.owner` role does not exist in the `authz_role` table THEN the system throws a foreign key constraint error and fails to create the application.

1.2 WHEN `createManagedApplication` executes its transaction and calls `prisma.authzAccountAccessGrant.create()` with `roleId: 'application.owner'` THEN the system raises `PrismaClientKnownRequestError` because the referenced role row is absent from `authz_role`.

1.3 WHEN `createManagedApplication` executes its transaction and calls `prisma.authzAssetsAccessGrant.create()` with `role_id: 'application.owner'` THEN the system raises `PrismaClientKnownRequestError` for the same missing role row.

1.4 WHEN `getAccessibleAccounts()` is called THEN the system queries `prisma.permit` to find accounts the user can switch into, even though the new `authz_account_access_grant` table is the authoritative source for account-level access.

1.5 WHEN `switchToDelegated()` is called THEN the system validates access by querying `prisma.permit`, which may not reflect grants recorded in the new authz tables.

1.6 WHEN `getAccessList()`, `getAccessDetails()`, `removeAccess()`, `updatePermissions()`, and `grantAccessByNeupId()` are called THEN they read from and write to `prisma.permit` instead of the new authz tables.

1.7 WHEN `acceptRequest()` processes an `access_invitation` THEN it creates a `prisma.permit` record instead of an `authzAccountAccessGrant` record.

1.8 WHEN `createDependentAccount()` runs THEN it creates `prisma.permit` records for guardian and dependent permissions instead of using the new authz tables.

1.9 WHEN `getPermissions()` and `updateUserPermissions()` in `services/manage/users.ts` are called THEN they read/write the `permit` table's `permissions` array, which is no longer the source of truth for `checkPermissions()`.

### Expected Behavior (Correct)

2.1 WHEN a user submits the "Add Application" form and the `application.owner` role does not yet exist in the `authz_role` table THEN the system SHALL ensure the role exists (by upserting it inside the transaction) before creating the access grants, so the application is created successfully.

2.2 WHEN `createManagedApplication` executes its transaction and creates an `authzAccountAccessGrant` with `roleId: 'application.owner'` THEN the system SHALL complete without a foreign key constraint error and return `{ success: true, appId: <newId> }`.

2.3 WHEN `createManagedApplication` executes its transaction and creates an `authzAssetsAccessGrant` with `role_id: 'application.owner'` THEN the system SHALL complete without a foreign key constraint error.

2.4 WHEN `getAccessibleAccounts()` is called THEN the system SHALL query `authzAccountAccessGrant` (joined with account data) to find accounts the user has been granted access to, instead of querying `permit`.

2.5 WHEN `switchToDelegated()` validates access THEN it SHALL check for an `authzAccountAccessGrant` record instead of a `permit` record.

2.6 WHEN `getAccessList()` is called THEN it SHALL return grants from `authzAccountAccessGrant` instead of `permit`.

2.7 WHEN `getAccessDetails()` is called THEN it SHALL return grant details from `authzAccountAccessGrant` instead of `permit`.

2.8 WHEN `removeAccess()` is called THEN it SHALL delete the corresponding `authzAccountAccessGrant` record instead of a `permit` record.

2.9 WHEN `updatePermissions()` is called THEN it SHALL update the role assignment in `authzAccountAccessGrant` instead of the `permissions` array in `permit`.

2.10 WHEN `grantAccessByNeupId()` is called THEN it SHALL create an `authzAccountAccessGrant` record instead of a `permit` record.

2.11 WHEN `acceptRequest()` processes an `access_invitation` THEN it SHALL create an `authzAccountAccessGrant` record instead of a `permit` record.

2.12 WHEN `createDependentAccount()` runs THEN it SHALL create `authzAccountAccessGrant` records for guardian and dependent access instead of `permit` records.

2.13 WHEN `getPermissions()` is called for an account THEN it SHALL resolve permissions from `authzAccountAccessGrant` + `authzRoleCapability` (the same path as `checkPermissions()`), not from `permit`.

2.14 WHEN `updateUserPermissions()` is called THEN it SHALL update the account's role assignments in `authzAccountAccessGrant` instead of writing to `permit`.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits the "Add Application" form and the `application.owner` role already exists in the `authz_role` table THEN the system SHALL CONTINUE TO create the application, portfolio, access grants, and asset grants exactly as before without duplication or error.

3.2 WHEN `createManagedApplication` is called with an invalid or empty application name THEN the system SHALL CONTINUE TO return `{ success: false, error: 'Invalid application name.' }` without touching the database.

3.3 WHEN `createManagedApplication` is called by a user without the `root.app.create` permission THEN the system SHALL CONTINUE TO return `{ success: false, error: 'Permission denied.' }`.

3.4 WHEN `createManagedApplication` is called by a user who already owns an application THEN the system SHALL CONTINUE TO reuse the existing portfolio and upsert the portfolio member record rather than creating duplicates.

3.5 WHEN `createManagedApplication` is called and an `authzAccountAccessGrant` for the same owner/target/role/app/portfolio combination already exists THEN the system SHALL CONTINUE TO skip the duplicate grant creation.

3.6 WHEN `checkPermissions()` is called THEN it SHALL CONTINUE TO resolve permissions from `authzAccountAccessGrant` + `authzRoleCapability` exactly as it does today.

3.7 WHEN `switchToBrand()` or `switchToDependent()` is called THEN they SHALL CONTINUE TO validate ownership via `accountOwnership` (not permit) as they do today.

3.8 WHEN `deleteUserAccount()` cleans up a user's data THEN it SHALL CONTINUE TO delete all associated records, including any remaining `permit` rows for backward compatibility during the transition.

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CreateApplicationRequest
  OUTPUT: boolean

  // The bug fires when the role row is absent from authz_role at insert time
  RETURN NOT EXISTS(SELECT 1 FROM authz_role WHERE id = 'application.owner')
END FUNCTION
```

**Fix Checking Property:**
```pascal
// Property: Fix Checking — role must exist before grants are inserted
FOR ALL X WHERE isBugCondition(X) DO
  result ← createManagedApplication'(X)
  ASSERT result.success = true
  ASSERT no_fk_constraint_error(result)
END FOR
```

**Preservation Property:**
```pascal
// Property: Preservation Checking — existing behavior unchanged when role already exists
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT createManagedApplication(X) = createManagedApplication'(X)
END FOR
```

---

## Affected Files

| File | Permit Usage | Migration Target |
|------|-------------|-----------------|
| `services/applications/manage.ts` | FK error — missing role | Upsert `authz_role` inside transaction |
| `services/manage/accounts/accessible.ts` | `permit.findMany` for account switching | `authzAccountAccessGrant.findMany` |
| `services/auth/switch.ts` | `permit.findFirst` to validate delegation | `authzAccountAccessGrant.findFirst` |
| `services/manage/access/index.ts` | All CRUD on `permit` | All CRUD on `authzAccountAccessGrant` |
| `services/manage/people/invitations.ts` | `permit.create` on access_invitation accept | `authzAccountAccessGrant.create` |
| `services/manage/accounts/dependent.ts` | `permit.create` for guardian + dependent | `authzAccountAccessGrant.create` |
| `services/manage/users.ts` | `permit.findFirst/create/update` for permissions | `authzAccountAccessGrant` + `authzRoleCapability` |
| `prisma/seed.ts` | `permit.create` for root admin | `authzAccountAccessGrant` + `authzRole` |
| `prisma/grant-root.ts` | `permit.create/update` for root | `authzAccountAccessGrant` + `authzRole` |
