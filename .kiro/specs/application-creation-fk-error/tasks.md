# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Application Creation FK Crash (Missing `application.owner` Role)
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the FK crash
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — any `CreateApplicationRequest` with a valid name and `root.app.create` permission, executed against a DB where `authz_role` does NOT contain `id = 'application.owner'`
  - From Bug Condition in design: `isBugCondition(X)` ≡ `NOT EXISTS(SELECT 1 FROM authz_role WHERE id = 'application.owner')`
  - Test that `createManagedApplication({ name: <any valid name> })` throws `PrismaClientKnownRequestError` with message matching `authz_account_access_grant_role_id_fkey` when the role row is absent
  - Also verify the `authz_assets_access_grant_role_id_fkey` constraint is triggered (secondary crash path)
  - Run test on UNFIXED code — **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `createManagedApplication({ name: 'Test App' })` throws FK constraint error instead of returning `{ success: true, appId: <uuid> }`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing `createManagedApplication` Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `application.owner` role already exists in `authz_role`)
  - Observe: `createManagedApplication({ name: '' })` returns `{ success: false, error: 'Invalid application name.' }` on unfixed code
  - Observe: `createManagedApplication({ name: 'x'.repeat(200) })` returns `{ success: false, error: 'Invalid application name.' }` on unfixed code
  - Observe: `createManagedApplication(...)` called without `root.app.create` permission returns `{ success: false, error: 'Permission denied.' }` on unfixed code
  - Observe: calling `createManagedApplication` twice with the same account does not create duplicate roles or grants on unfixed code
  - Write property-based tests from Preservation Requirements in design:
    - For all invalid names (empty, whitespace-only, >120 chars): result is `{ success: false, error: 'Invalid application name.' }`
    - For all calls without `root.app.create` permission: result is `{ success: false, error: 'Permission denied.' }`
    - For all calls when `application.owner` role already exists: result equals the unfixed code result (idempotent upserts, no duplicates)
  - Run tests on UNFIXED code (with role pre-seeded for the idempotency case)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix `createManagedApplication` — upsert role and capabilities inside transaction

  - [ ] 3.1 Implement the fix in `services/applications/manage.ts`
    - Inside the `prisma.$transaction` callback, before any grant inserts, add upserts for:
      - Three `authzCapability` rows: `application.view`, `application.edit`, `application.delete` (all with `appId: 'neup.account'`)
      - One `authzRole` row: `{ id: 'application.owner', name: 'application.owner', scope: 'application', appId: 'neup.account' }`
      - Three `authzRoleCapability` rows linking `application.owner` to each capability, with stable IDs (e.g., `'application.owner::application.view'`) and `denormalizedCapability` set to the capability name array
    - Use `upsert` (not `create`) with stable IDs so re-runs are idempotent and do not break the existing path where the role was pre-seeded
    - Leave the existing `authzAccountAccessGrant.create` and `authzAssetsAccessGrant.create` calls unchanged — they will now succeed because the role row is guaranteed to exist
    - _Bug_Condition: `isBugCondition(X)` ≡ `NOT EXISTS(SELECT 1 FROM authz_role WHERE id = 'application.owner')`_
    - _Expected_Behavior: `createManagedApplication(X)` returns `{ success: true, appId: <uuid> }` without FK constraint error_
    - _Preservation: validation errors, permission-denied paths, duplicate-grant guards, and all other code paths must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.4, 3.5_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Application Creation Succeeds Without Pre-seeded Role
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior: `createManagedApplication` returns `{ success: true, appId }` when `application.owner` was absent before the call
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behavior Unchanged After Fix
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in validation, permission-denied, and idempotency paths)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Migrate `services/manage/accounts/accessible.ts` — replace `permit` with `authzAccountAccessGrant`

  - [ ] 4.1 Update `getAccessibleAccounts` in `services/manage/accounts/accessible.ts`
    - Replace `prisma.permit.findMany({ where: { accountId: personalAccountId, forSelf: false } })` with `prisma.authzAccountAccessGrant.findMany({ where: { ownerAccountId: personalAccountId }, include: { target: { include: { neupIds: { where: { isPrimary: true } } } } } })`
    - Map `grant.targetAccountId` → `grant.target` for account data (display name, account type, display image)
    - Remove the `permit` import dependency from this file
    - _Requirements: 2.4_

- [ ] 5. Migrate `services/auth/switch.ts` — replace `permit` check with `authzAccountAccessGrant`

  - [ ] 5.1 Update `switchToDelegated` in `services/auth/switch.ts`
    - Replace `prisma.permit.findFirst({ where: { accountId: personalAccountId, targetAccountId: accountId, forSelf: false } })` with `prisma.authzAccountAccessGrant.findFirst({ where: { ownerAccountId: personalAccountId, targetAccountId: accountId } })`
    - Rename the result variable from `permit` to `grant` for clarity
    - Ensure the null-check logic is preserved (if no grant found, deny the switch)
    - _Requirements: 2.5_

- [ ] 6. Migrate `services/manage/access/index.ts` — replace all `permit` CRUD

  - [ ] 6.1 Update `getAccessList` in `services/manage/access/index.ts`
    - Replace `prisma.permit.findMany({ where: { targetAccountId: accountId, forSelf: false, isRoot: false } })` with `prisma.authzAccountAccessGrant.findMany({ where: { ownerAccountId: accountId } })`
    - Map `grant.targetAccountId` → `userId`, `grant.id` → `permitId`, `grant.roleId` → `permissions[0]`
    - _Requirements: 2.6_

  - [ ] 6.2 Update `getAccessDetails` in `services/manage/access/index.ts`
    - Replace `prisma.permit.findUnique({ where: { id: permitId } })` with `prisma.authzAccountAccessGrant.findUnique({ where: { id: permitId } })`
    - Account for the semantic inversion: in `authzAccountAccessGrant`, `ownerAccountId` is the account being managed and `targetAccountId` is the accessor (opposite of the old `permit` model)
    - _Requirements: 2.7_

  - [ ] 6.3 Update `removeAccess` in `services/manage/access/index.ts`
    - Replace `prisma.permit.findUnique` + `prisma.permit.delete` with `prisma.authzAccountAccessGrant.findUnique` + `prisma.authzAccountAccessGrant.delete`
    - Authorization check: `grant.ownerAccountId === currentAccountId`
    - _Requirements: 2.8_

  - [ ] 6.4 Update `updatePermissions` in `services/manage/access/index.ts`
    - Replace `prisma.permit.update({ data: { permissions: newPermissionIds } })` with `prisma.authzAccountAccessGrant.update({ data: { roleId: newPermissionIds[0] } })`
    - If `newPermissionIds` is empty, delete the grant instead of updating
    - Authorization check: `grant.ownerAccountId === currentAccountId`
    - _Requirements: 2.9_

  - [ ] 6.5 Update `grantAccessByNeupId` in `services/manage/access/index.ts`
    - Before creating the grant, upsert the `account.delegate` role in `authzRole` with `appId: 'neup.account'`, `scope: 'account'`
    - Replace the duplicate-check `prisma.permit.findFirst` with `prisma.authzAccountAccessGrant.findFirst`
    - Replace `prisma.permit.create` with `prisma.authzAccountAccessGrant.create({ data: { ownerAccountId: ..., targetAccountId: ..., roleId: 'account.delegate', appId: 'neup.account' } })`
    - _Requirements: 2.10_

- [ ] 7. Migrate `services/manage/people/invitations.ts` — replace `permit.create` in `acceptRequest`

  - [ ] 7.1 Update the `access_invitation` branch of `acceptRequest` in `services/manage/people/invitations.ts`
    - Before creating the grant, upsert the `account.delegate` role in `authzRole` with `appId: 'neup.account'`, `scope: 'account'`
    - Replace `tx.permit.create({ data: { accountId: inviteeId, targetAccountId: request.senderId, permissions: ['independent.default'], forSelf: false, isRoot: false } })` with `tx.authzAccountAccessGrant.create({ data: { ownerAccountId: request.senderId, targetAccountId: inviteeId, roleId: 'account.delegate', appId: 'neup.account' } })`
    - Leave the `family_invitation` branch and all other `acceptRequest` logic unchanged
    - _Requirements: 2.11_

- [ ] 8. Migrate `services/manage/accounts/dependent.ts` — replace `permit.create` calls

  - [ ] 8.1 Update `createDependentAccount` in `services/manage/accounts/dependent.ts`
    - Before creating grants, upsert two roles in `authzRole`:
      - `{ id: 'account.guardian', name: 'account.guardian', scope: 'account', appId: 'neup.account' }`
      - `{ id: 'account.dependent', name: 'account.dependent', scope: 'account', appId: 'neup.account' }`
    - Replace the first `prisma.permit.create` (guardian grant) with `prisma.authzAccountAccessGrant.create({ data: { ownerAccountId: dependentAccountId, targetAccountId: guardianAccountId, roleId: 'account.guardian', appId: 'neup.account' } })`
    - Replace the second `prisma.permit.create` (dependent self-grant) with `prisma.authzAccountAccessGrant.create({ data: { ownerAccountId: dependentAccountId, targetAccountId: dependentAccountId, roleId: 'account.dependent', appId: 'neup.account' } })`
    - _Requirements: 2.12_

- [ ] 9. Migrate `services/manage/users.ts` — replace `getPermissions` / `updateUserPermissions`

  - [ ] 9.1 Update `getPermissions` in `services/manage/users.ts`
    - Replace `prisma.permit.findFirst({ where: { accountId, forSelf: true } })` with a call to `getAccountPermission(accountId)` (already available from `services/user.ts`)
    - Return the resolved capabilities as `allPermissions`; `assignedPermissions` and `restrictedPermissions` can be derived from the role grants (the old `restrictions[]` concept has no equivalent in the new model)
    - _Requirements: 2.13_

  - [ ] 9.2 Update `updateUserPermissions` in `services/manage/users.ts`
    - Replace the `permit.findFirst` / `permit.create` / `permit.update` logic with authz-table writes
    - Upsert a custom role named `account.custom.<accountId>` with the requested capabilities in `authzRoleCapability` (with `denormalizedCapability` set to the capability name array)
    - Upsert an `authzAccountAccessGrant` pointing to that custom role for the account
    - Ensure the result is visible to `checkPermissions()` (which reads `authzRoleCapability.denormalizedCapability`)
    - _Requirements: 2.14_

  - [ ] 9.3 Preserve `deleteUserAccount` permit cleanup in `services/manage/users.ts`
    - Keep `prisma.permit.deleteMany` in `deleteUserAccount` as-is for backward compatibility during the transition period
    - _Requirements: 3.8_

- [ ] 10. Migrate `prisma/seed.ts` and `prisma/grant-root.ts` — replace root `permit` with authz grants

  - [ ] 10.1 Update `prisma/seed.ts`
    - Remove the `prisma.permit.findFirst` / `prisma.permit.create` / `prisma.permit.update` block for the root permit
    - Replace with:
      - Upsert `authzRole` row `{ id: 'account.root', name: 'account.root', scope: 'root', appId: 'neup.account' }`
      - Upsert `authzAccountAccessGrant` row `{ ownerAccountId: accountId, targetAccountId: accountId, roleId: 'account.root', appId: 'neup.account' }`
    - Keep the account creation, NeupID, and auth method logic unchanged
    - _Requirements: 2.13, 2.14_

  - [ ] 10.2 Update `prisma/grant-root.ts`
    - Remove the `prisma.permit.findFirst` / `prisma.permit.create` / `prisma.permit.update` block
    - Replace with:
      - Upsert `authzRole` row `{ id: 'account.root', name: 'account.root', scope: 'root', appId: 'neup.account' }`
      - Upsert `authzAccountAccessGrant` row `{ ownerAccountId: accountId, targetAccountId: accountId, roleId: 'account.root', appId: 'neup.account' }`
    - Keep the argument parsing and account lookup logic unchanged
    - _Requirements: 2.13, 2.14_

- [ ] 11. Checkpoint — Ensure all tests pass
  - Re-run the full test suite (unit, property-based, and integration tests)
  - Verify Property 1 (bug condition exploration test) passes — `createManagedApplication` succeeds without a pre-seeded role
  - Verify Property 2 (preservation tests) passes — validation errors, permission-denied paths, and idempotency behavior are unchanged
  - Verify `checkPermissions()` continues to resolve permissions from `authzAccountAccessGrant` + `authzRoleCapability` (no changes to `services/user.ts`)
  - Verify `switchToBrand()` and `switchToDependent()` still validate ownership via `accountOwnership`
  - Verify `deleteUserAccount()` still cleans up `permit` rows
  - Ensure all tests pass; ask the user if questions arise
