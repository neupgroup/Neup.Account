# Application Creation FK Error — Bugfix Design

## Overview

The codebase is mid-migration from the legacy `permit` table to the new `authz_*` tables. The immediate crash is a Prisma foreign key constraint violation in `createManagedApplication`: it inserts into `authz_account_access_grant` with `roleId: 'application.owner'`, but that role row does not exist in `authz_role` unless the optional seed script `prisma/02_neupaccount_applicationRole.ts` was run manually.

The fix has two parts:

1. **Immediate fix** — upsert the `application.owner` role (and its capabilities) inside the `createManagedApplication` transaction, before any grant inserts, so the FK constraint is always satisfied regardless of seed state.
2. **Migration** — replace all remaining `prisma.permit.*` usages across 8 additional files with the equivalent `authzAccountAccessGrant` / `authzRole` / `authzRoleCapability` operations, completing the migration that `checkPermissions()` already assumes is done.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the crash — the `application.owner` role row is absent from `authz_role` at the time `createManagedApplication` attempts to insert into `authz_account_access_grant`.
- **Property (P)**: The desired behavior when the bug condition holds — the application is created successfully and `{ success: true, appId }` is returned.
- **Preservation**: All existing behavior that must remain unchanged by the fix — validation errors, permission checks, duplicate-grant guards, and all other code paths that do not involve the missing role.
- **`authz_role`**: Table that defines named roles (`id`, `name`, `scope`, `appId`). Every `roleId` in `authz_account_access_grant` and `authz_assets_access_grant` must reference a row here.
- **`authz_capability`**: Table that defines named capabilities (`id`, `name`, `scope`, `appId`).
- **`authz_role_capability`**: Join table mapping roles to capabilities, with a denormalized `denormalizedCapability` JSON array used by `getAccountPermission()` for fast reads.
- **`authz_account_access_grant`**: Grants account-level access: `{ ownerAccountId, targetAccountId, roleId, appId, portfolioId }`. This is the authoritative source for `checkPermissions()`.
- **`authz_assets_access_grant`**: Grants asset-level access: `{ asset_id, account_id, role_id, portfolio_id, app_id, asset_type }`.
- **`permit`**: Legacy table (`accountId`, `targetAccountId`, `forSelf`, `isRoot`, `permissions[]`, `restrictions[]`). Still written to by several services but no longer read by `checkPermissions()`. Being phased out.
- **`createManagedApplication`**: The server action in `services/applications/manage.ts` that creates an application, portfolio, and access grants in a single transaction.
- **`checkPermissions()`**: The function in `services/user.ts` that resolves permissions exclusively from `authzAccountAccessGrant` + `authzRoleCapability`. It does **not** read `permit`.
- **`getAccountPermission()`**: Helper called by `checkPermissions()` — queries `authzAccountAccessGrant` where `targetAccountId = activeId AND appId = 'neup.account'`, then resolves capabilities via `authzRoleCapability`.

---

## Bug Details

### Bug Condition

The bug manifests when `createManagedApplication` is called and the `application.owner` role does not yet exist in the `authz_role` table. The transaction attempts to insert a row into `authz_account_access_grant` with `roleId: 'application.owner'`, which violates the FK constraint `authz_account_access_grant_role_id_fkey`.

**Formal Specification:**

```
FUNCTION isBugCondition(X)
  INPUT: X of type CreateApplicationRequest
  OUTPUT: boolean

  RETURN NOT EXISTS(
    SELECT 1 FROM authz_role WHERE id = 'application.owner'
  )
END FUNCTION
```

The secondary bug condition (stale `permit` reads) is a correctness issue rather than a crash, but it is part of the same migration gap:

```
FUNCTION isPermitMigrationGap(operation)
  INPUT: operation — any call to getAccessibleAccounts, switchToDelegated,
                     getAccessList, getAccessDetails, removeAccess,
                     updatePermissions, grantAccessByNeupId, acceptRequest,
                     createDependentAccount, getPermissions, updateUserPermissions
  OUTPUT: boolean

  RETURN operation READS FROM permit
         OR operation WRITES TO permit
         AND checkPermissions() DOES NOT READ permit
END FUNCTION
```

### Examples

- **Crash case**: A fresh environment where only `prisma/seed.ts` was run (no `02_neupaccount_applicationRole.ts`). User submits "Add Application" → `createManagedApplication` → `authzAccountAccessGrant.create({ roleId: 'application.owner' })` → `PrismaClientKnownRequestError: Foreign key constraint violated on authz_account_access_grant_role_id_fkey`.
- **Silent data divergence**: `getAccessibleAccounts()` queries `permit` for delegation grants. A grant created via `grantAccessByNeupId` (which also writes to `permit`) appears correctly. But a grant created by a future fixed version of `grantAccessByNeupId` (which writes to `authzAccountAccessGrant`) would be invisible to `getAccessibleAccounts()`.
- **Permission resolution gap**: `updateUserPermissions()` writes permission strings to `permit.permissions[]`. `checkPermissions()` never reads that array — it reads `authzRoleCapability.denormalizedCapability`. So permission updates via the admin UI have no effect on actual access checks.
- **Preserved case**: A user who already ran `02_neupaccount_applicationRole.ts` can create applications without error. The fix must not break this path or create duplicate roles/grants.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- `createManagedApplication` with an invalid or empty name MUST continue to return `{ success: false, error: 'Invalid application name.' }` without touching the database.
- `createManagedApplication` called without `root.app.create` permission MUST continue to return `{ success: false, error: 'Permission denied.' }`.
- `createManagedApplication` called when the `application.owner` role **already exists** MUST continue to create the application, portfolio, and grants without duplication or error (idempotent upserts).
- `createManagedApplication` called when an `authzAccountAccessGrant` for the same owner/target/role/app/portfolio already exists MUST continue to skip duplicate grant creation.
- `checkPermissions()` MUST continue to resolve permissions from `authzAccountAccessGrant` + `authzRoleCapability` exactly as it does today — no changes to `services/user.ts`.
- `switchToBrand()` and `switchToDependent()` MUST continue to validate ownership via `accountOwnership`, not via any permit or grant table.
- `deleteUserAccount()` MUST continue to delete all associated `permit` rows for backward compatibility during the transition period.
- All other functions not listed in the affected files table MUST be completely unaffected.

**Scope:**

All inputs that do NOT involve the missing `application.owner` role or the `permit`-to-authz migration are completely unaffected. This includes:

- Application reads (`getManagedApplication`, `getManagedApplications`, `getApplicationDetailsForViewer`)
- Application updates (`saveApplicationSecret`, `saveApplicationAccess`, `saveApplicationPolicies`, `saveApplicationEndpoints`, `updateManagedApplicationStatus`)
- Authentication flows (`switchToBrand`, `switchToDependent`, `switchToPersonal`, `bridgeSwitchAccountBySessionId`)
- Family invitation flows (`acceptRequest` for `family_invitation` action)
- All admin actions in `services/manage/users.ts` except `getPermissions` and `updateUserPermissions`

---

## Hypothesized Root Cause

### 1. Missing Role Seed (Primary — Immediate Crash)

`createManagedApplication` was written assuming `02_neupaccount_applicationRole.ts` had been run. That script upserts the `application.owner` role into `authz_role`. It is not called by `prisma/seed.ts` and is not part of any migration, so it is easy to miss in a fresh environment. The fix is to make the role upsert part of the transaction itself, removing the external dependency.

### 2. Incomplete Migration (Secondary — Data Divergence)

The migration from `permit` to `authz_*` was done incrementally. `checkPermissions()` and `createManagedApplication` were updated first. The remaining 8 files still write to and read from `permit`. Because `checkPermissions()` no longer reads `permit`, any permission or delegation data written to `permit` by these files is effectively invisible to the permission-checking path. This creates silent correctness bugs.

### 3. Role Convention Gap for Delegation Grants

The new `authz_account_access_grant` table requires a `roleId` FK. The legacy `permit` table stored free-form permission strings in a `permissions[]` array. When migrating delegation grants (guardian → dependent, access invitations, root grants), new role rows must be upserted first. The role conventions to use are:

- `account.delegate` — for access invitation grants (one account managing another)
- `account.guardian` — for guardian → dependent grants
- `account.root` — for root/admin grants
- `application.owner` — for application ownership grants (already defined in `02_neupaccount_applicationRole.ts`)

All delegation roles use `appId: 'neup.account'` and `scope: 'account'`.

### 4. `getPermissions` / `updateUserPermissions` Semantic Mismatch

These functions in `services/manage/users.ts` read and write `permit.permissions[]` as if it were the source of truth. Since `checkPermissions()` reads `authzRoleCapability.denormalizedCapability` instead, the admin UI for editing permissions has no effect on actual access. The fix must redirect these functions to read/write `authzAccountAccessGrant` + `authzRoleCapability`.

---

## Correctness Properties

Property 1: Bug Condition — Application Creation Succeeds Without Pre-seeded Role

_For any_ `CreateApplicationRequest` where `isBugCondition` holds (the `application.owner` role does not exist in `authz_role`), the fixed `createManagedApplication` function SHALL upsert the role and its capabilities inside the transaction and return `{ success: true, appId: <uuid> }` without raising a foreign key constraint error.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Existing Application Creation Behavior Unchanged

_For any_ `CreateApplicationRequest` where `isBugCondition` does NOT hold (the `application.owner` role already exists), the fixed `createManagedApplication` function SHALL produce the same result as the original function — creating the application, portfolio, and grants without duplication, and returning `{ success: true, appId }`.

**Validates: Requirements 3.1, 3.4, 3.5**

Property 3: Migration Correctness — Permit Reads Replaced by AuthzAccountAccessGrant Reads

_For any_ call to `getAccessibleAccounts`, `switchToDelegated`, `getAccessList`, `getAccessDetails`, `removeAccess`, `updatePermissions`, `grantAccessByNeupId`, `acceptRequest` (access_invitation), `createDependentAccount`, `getPermissions`, or `updateUserPermissions`, the fixed functions SHALL read from and write to `authzAccountAccessGrant` (and related authz tables) instead of `permit`, producing results consistent with what `checkPermissions()` observes.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14**

Property 4: Preservation — Non-Affected Code Paths Unchanged

_For any_ input that does NOT involve the missing role or the permit-to-authz migration (validation errors, permission-denied paths, brand/dependent switches, family invitations, application reads/updates, admin actions), the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.2, 3.3, 3.6, 3.7, 3.8**

---

## Fix Implementation

### Changes Required

#### File 1: `services/applications/manage.ts`

**Function**: `createManagedApplication` (inside the `prisma.$transaction` callback)

**Specific Changes**:

1. **Upsert capabilities** — before creating any grants, upsert the three `authzCapability` rows (`application.view`, `application.edit`, `application.delete`) with `appId: 'neup.account'`.
2. **Upsert role** — upsert the `authzRole` row `{ id: 'application.owner', name: 'application.owner', scope: 'application', appId: 'neup.account' }`.
3. **Upsert role-capability maps** — upsert three `authzRoleCapability` rows linking `application.owner` to each capability, with `denormalizedCapability` set to the capability name array.
4. **No change to grant creation** — the existing `authzAccountAccessGrant.create` and `authzAssetsAccessGrant.create` calls remain as-is; they will now succeed because the role row is guaranteed to exist.

The upserts must use stable IDs (e.g., `id: 'application.owner'` for the role, `id: 'application.owner::application.view'` for the capability maps) so re-runs are idempotent.

#### File 2: `services/manage/accounts/accessible.ts`

**Function**: `getAccessibleAccounts`

**Specific Changes**:

1. Replace `prisma.permit.findMany({ where: { accountId: personalAccountId, forSelf: false } })` with `prisma.authzAccountAccessGrant.findMany({ where: { ownerAccountId: personalAccountId }, include: { target: { include: { neupIds: { where: { isPrimary: true } } } } } })`.
2. Map `grant.targetAccountId` → `grant.target` for account data (display name, account type, display image).
3. Remove the `permit` import dependency.

#### File 3: `services/auth/switch.ts`

**Function**: `switchToDelegated`

**Specific Changes**:

1. Replace `prisma.permit.findFirst({ where: { accountId: personalAccountId, targetAccountId: accountId, forSelf: false } })` with `prisma.authzAccountAccessGrant.findFirst({ where: { ownerAccountId: personalAccountId, targetAccountId: accountId } })`.
2. Update the null-check variable name from `permit` to `grant`.

#### File 4: `services/manage/access/index.ts`

**Functions**: `getAccessList`, `getAccessDetails`, `removeAccess`, `updatePermissions`, `grantAccessByNeupId`

**Specific Changes**:

1. **`getAccessList(accountId)`** — replace `prisma.permit.findMany({ where: { targetAccountId: accountId, forSelf: false, isRoot: false } })` with `prisma.authzAccountAccessGrant.findMany({ where: { ownerAccountId: accountId } })`. Map `grant.targetAccountId` → `userId`, `grant.id` → `permitId`, `grant.roleId` → `permissions[0]`.

2. **`getAccessDetails(permitId)`** — replace `prisma.permit.findUnique({ where: { id: permitId } })` with `prisma.authzAccountAccessGrant.findUnique({ where: { id: permitId } })`. Map `grant.targetAccountId` → grantedBy account, `grant.ownerAccountId` → grantedTo account (note: the semantic is inverted from the old permit model — in the new model `ownerAccountId` is the account being managed, `targetAccountId` is the account that has been granted access).

   > **Semantic note**: In `permit`, `targetAccountId` was the account being managed and `accountId` was the accessor. In `authzAccountAccessGrant`, `ownerAccountId` is the account being managed and `targetAccountId` is the accessor. All field mappings must account for this inversion.

3. **`removeAccess(permitId)`** — replace `prisma.permit.findUnique` + `prisma.permit.delete` with `prisma.authzAccountAccessGrant.findUnique` + `prisma.authzAccountAccessGrant.delete`. Authorization check: `grant.ownerAccountId === currentAccountId`.

4. **`updatePermissions(permitId, newPermissionIds)`** — the new model stores a single `roleId` per grant rather than a `permissions[]` array. Replace `prisma.permit.update({ data: { permissions: newPermissionIds } })` with `prisma.authzAccountAccessGrant.update({ data: { roleId: newPermissionIds[0] } })`. If `newPermissionIds` is empty, delete the grant. Authorization check: `grant.ownerAccountId === currentAccountId`.

5. **`grantAccessByNeupId`** — replace the duplicate-check `prisma.permit.findFirst` and the final `prisma.permit.create` (inside `acceptRequest`) with `prisma.authzAccountAccessGrant.findFirst` and `prisma.authzAccountAccessGrant.create`. The role to use is `account.delegate` (must be upserted first). The `appId` is `'neup.account'`.

#### File 5: `services/manage/people/invitations.ts`

**Function**: `acceptRequest` (the `access_invitation` branch)

**Specific Changes**:

1. Before creating the grant, upsert the `account.delegate` role in `authzRole` with `appId: 'neup.account'`, `scope: 'account'`.
2. Replace `tx.permit.create({ data: { accountId: inviteeId, targetAccountId: request.senderId, permissions: ['independent.default'], forSelf: false, isRoot: false } })` with `tx.authzAccountAccessGrant.create({ data: { ownerAccountId: request.senderId, targetAccountId: inviteeId, roleId: 'account.delegate', appId: 'neup.account' } })`.

#### File 6: `services/manage/accounts/dependent.ts`

**Function**: `createDependentAccount`

**Specific Changes**:

1. Before creating grants, upsert two roles: `account.guardian` (for the guardian's grant) and `account.dependent` (for the dependent's self-grant), both with `appId: 'neup.account'`, `scope: 'account'`.
2. Replace the first `prisma.permit.create` (guardian grant) with `prisma.authzAccountAccessGrant.create({ data: { ownerAccountId: dependentAccountId, targetAccountId: guardianAccountId, roleId: 'account.guardian', appId: 'neup.account' } })`.
3. Replace the second `prisma.permit.create` (dependent self-grant) with `prisma.authzAccountAccessGrant.create({ data: { ownerAccountId: dependentAccountId, targetAccountId: dependentAccountId, roleId: 'account.dependent', appId: 'neup.account' } })`.

#### File 7: `services/manage/users.ts`

**Functions**: `getPermissions`, `updateUserPermissions`

**Specific Changes**:

1. **`getPermissions(accountId)`** — replace `prisma.permit.findFirst({ where: { accountId, forSelf: true } })` with a call to `getAccountPermission(accountId)` (already imported from `services/user.ts`). Return the resolved capabilities as `allPermissions`. `assignedPermissions` and `restrictedPermissions` can be derived from the role grants (or simplified to just `allPermissions` since the old `restrictions[]` concept has no equivalent in the new model).

2. **`updateUserPermissions(accountId, newPermissionIds, newRestrictionIds)`** — this function's semantics must change. In the new model, permissions are derived from roles, not stored as raw strings. The implementation should upsert an `authzAccountAccessGrant` with a role that maps to the requested capabilities, or update the `authzRoleCapability` denormalized array for the account's role. The simplest correct approach: upsert a custom role named `account.custom.<accountId>` with the requested capabilities, then upsert an `authzAccountAccessGrant` pointing to that role.

3. **`deleteUserAccount`** — keep `prisma.permit.deleteMany` as-is for backward compatibility cleanup.

#### File 8: `prisma/seed.ts`

**Specific Changes**:

1. Remove the `prisma.permit.findFirst` / `prisma.permit.create` / `prisma.permit.update` block for the root permit.
2. Replace with:
   - Upsert `authzRole` row `{ id: 'account.root', name: 'account.root', scope: 'root', appId: 'neup.account' }`.
   - Upsert `authzAccountAccessGrant` row `{ ownerAccountId: accountId, targetAccountId: accountId, roleId: 'account.root', appId: 'neup.account' }`.
3. Keep the account creation, NeupID, and auth method logic unchanged.

#### File 9: `prisma/grant-root.ts`

**Specific Changes**:

1. Remove the `prisma.permit.findFirst` / `prisma.permit.create` / `prisma.permit.update` block.
2. Replace with:
   - Upsert `authzRole` row `{ id: 'account.root', name: 'account.root', scope: 'root', appId: 'neup.account' }`.
   - Upsert `authzAccountAccessGrant` row `{ ownerAccountId: accountId, targetAccountId: accountId, roleId: 'account.root', appId: 'neup.account' }`.
3. Keep the argument parsing and account lookup logic unchanged.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the FK crash BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write a test that calls `createManagedApplication` in an environment where the `authz_role` table does not contain `application.owner`. Assert that the call throws (or returns an error containing "Foreign key constraint"). Run on unfixed code to observe the failure.

**Test Cases**:

1. **Missing role crash** — call `createManagedApplication({ name: 'Test App' })` with `authz_role` empty → expect `PrismaClientKnownRequestError` with `authz_account_access_grant_role_id_fkey` (will fail on unfixed code, should pass after fix).
2. **Missing assets role crash** — same setup, but verify the `authz_assets_access_grant_role_id_fkey` constraint is also triggered (will fail on unfixed code).
3. **Permit divergence** — call `getAccessibleAccounts()` after creating a grant via `authzAccountAccessGrant.create` directly → expect the account to appear in results (will fail on unfixed code because `getAccessibleAccounts` reads `permit`).
4. **Permission write gap** — call `updateUserPermissions(accountId, ['root.app.create'], [])` then call `checkPermissions(['root.app.create'], accountId)` → expect `true` (will fail on unfixed code because `updateUserPermissions` writes to `permit` but `checkPermissions` reads `authzRoleCapability`).

**Expected Counterexamples**:

- `createManagedApplication` throws `PrismaClientKnownRequestError` with FK constraint message.
- `getAccessibleAccounts` returns empty array even when `authzAccountAccessGrant` rows exist.
- `checkPermissions` returns `false` even after `updateUserPermissions` writes to `permit`.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**

```
FOR ALL X WHERE isBugCondition(X) DO
  result := createManagedApplication_fixed(X)
  ASSERT result.success = true
  ASSERT result.appId IS NOT NULL
  ASSERT no_fk_constraint_error(result)
  ASSERT EXISTS(SELECT 1 FROM authz_role WHERE id = 'application.owner')
  ASSERT EXISTS(SELECT 1 FROM authz_account_access_grant WHERE roleId = 'application.owner' AND appId = result.appId)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**

```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT createManagedApplication_original(X) = createManagedApplication_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:

- It generates many test cases automatically across the input domain (valid names, invalid names, duplicate names, various account states).
- It catches edge cases that manual unit tests might miss (e.g., names with special characters, very long names, names that are exactly at the length limit).
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on unfixed code first for the validation and permission-denied paths, then write property-based tests capturing that behavior.

**Test Cases**:

1. **Validation preservation** — generate random invalid names (empty, whitespace-only, >120 chars) → verify `{ success: false, error: 'Invalid application name.' }` before and after fix.
2. **Permission-denied preservation** — call `createManagedApplication` as a user without `root.app.create` → verify `{ success: false, error: 'Permission denied.' }` before and after fix.
3. **Idempotent role upsert** — call `createManagedApplication` twice with the same account → verify no duplicate roles, no duplicate grants, second call succeeds.
4. **Existing role preservation** — seed `application.owner` role first, then call `createManagedApplication` → verify behavior is identical to the unfixed code path (no extra DB writes, same return value).

### Unit Tests

- Test that `createManagedApplication` upserts `application.owner` role and capabilities inside the transaction.
- Test that `createManagedApplication` returns `{ success: false }` for invalid names without touching the DB.
- Test that `getAccessibleAccounts` returns accounts from `authzAccountAccessGrant`, not `permit`.
- Test that `switchToDelegated` checks `authzAccountAccessGrant`, not `permit`.
- Test that `getAccessList` maps `authzAccountAccessGrant` rows to `UserAccess` objects correctly.
- Test that `removeAccess` deletes from `authzAccountAccessGrant` and enforces `ownerAccountId` authorization.
- Test that `updatePermissions` updates `roleId` on `authzAccountAccessGrant`.
- Test that `acceptRequest` (access_invitation) creates an `authzAccountAccessGrant` with `roleId: 'account.delegate'`.
- Test that `createDependentAccount` creates `authzAccountAccessGrant` rows for guardian and dependent.
- Test that `getPermissions` returns capabilities from `authzRoleCapability`, not `permit.permissions[]`.
- Test that `updateUserPermissions` writes to `authzAccountAccessGrant` and the result is visible to `checkPermissions`.
- Test that `seed.ts` and `grant-root.ts` upsert `account.root` role and grant without touching `permit`.

### Property-Based Tests

- Generate random valid application names and verify `createManagedApplication` always returns `{ success: true }` when the user has `root.app.create` permission (regardless of whether the role was pre-seeded).
- Generate random account pairs and verify that granting access via `grantAccessByNeupId` + accepting via `acceptRequest` results in the grantee appearing in `getAccessibleAccounts` for the grantor.
- Generate random permission sets and verify that `updateUserPermissions` followed by `checkPermissions` returns consistent results (what was written is what is checked).
- Generate random inputs to `createManagedApplication` (invalid names, missing auth) and verify the validation and auth-check paths return the same results before and after the fix.

### Integration Tests

- Full flow: fresh DB → run `seed.ts` → call `createManagedApplication` → verify application created, role exists, grants exist, `getManagedApplications` returns the new app.
- Full flow: `grantAccessByNeupId` → `acceptRequest` → `getAccessibleAccounts` → `switchToDelegated` → verify the delegated account is accessible.
- Full flow: `createDependentAccount` → `getDependentAccounts` → `switchToDependent` → verify the dependent account is accessible.
- Full flow: `updateUserPermissions` → `checkPermissions` → verify the updated permissions are enforced.
- Regression: run `grant-root.ts` on an existing account → verify `isRootUser` returns `true` and `checkPermissions(['root.app.create'])` returns `true`.
