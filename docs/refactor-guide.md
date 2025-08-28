# Application Refactoring Guide

This document outlines a step-by-step process to refactor the application, reduce code duplication, improve maintainability, and establish a more robust architecture.

Follow these steps in order by providing the instruction for each step.

---

### Step 1: Centralize Core Data Schemas

**Instruction:** "Refactor Step 1: Centralize all Zod schemas into the `/src/schemas` directory."

**Goal:** Move all Zod validation schemas, which are currently scattered across various `actions.ts` and page files, into a centralized `/src/schemas` directory. This creates a single source of truth for data validation.

**Tasks:**
1. Create new schema files: `src/schemas/auth.ts`, `src/schemas/profile.ts`, `src/schemas/security.ts`.
2. Move relevant schemas (like `loginFormSchema`, `profileFormSchema`, `changePasswordSchema`, etc.) into the appropriate new files.
3. Update all component and action files to import schemas from their new, centralized location.

---

### Step 2: Consolidate User Data and Permission Logic

**Instruction:** "Refactor Step 2: Consolidate all user data and permission logic into `lib/user.ts`."

**Goal:** Create a single, reliable source for fetching user-related information and checking permissions, eliminating redundant implementations across the codebase.

**Tasks:**
1. Move all core user-data fetching functions (`getUserProfile`, `getUserNeupIds`, `getUserContacts`) into `src/lib/user.ts`.
2. Move the `getUserPermissions` and `checkPermissions` logic into `src/lib/user.ts`.
3. Update all files that use these functions to import them from `src/lib/user.ts`.

---

### Step 3: Centralize Session and Authentication Actions

**Instruction:** "Refactor Step 3: Centralize session and authentication actions into `lib/session.ts` and `lib/auth-actions.ts`."

**Goal:** Separate cookie/session logic from higher-level authentication actions.

**Tasks:**
1. Move cookie-handling logic into `src/lib/session.ts`.
2. Create `src/lib/auth-actions.ts` for functions that orchestrate authentication, such as `validateCurrentSession`, `getActiveAccountId`, and `getPersonalAccountId`.
3. Refactor all files to import these functions from their new, logical locations.

---

### Step 4: Refactor the Profile Update Logic

**Instruction:** "Refactor Step 4: Simplify the profile update logic and component structure."

**Goal:** Streamline the profile pages for both individual and brand accounts.

**Tasks:**
1. Consolidate the profile update logic into a single `src/actions/profile.ts`.
2. Refactor the `IndividualProfileForm` and `BrandProfileForm` to be cleaner and more efficient, relying on the centralized action.
3. Ensure the main profile page (`/manage/profile/page.tsx`) correctly determines which form to display based on the active account type.

---

### Step 5: Unify Root Action Files

**Instruction:** "Refactor Step 5: Unify all root management actions."

**Goal:** Consolidate scattered `root` server actions into a more organized structure.

**Tasks:**
1. Merge actions from `src/actions/root/permission/[id].ts` and `src/actions/root/permission/actions.ts` into a single `src/actions/root/permission.ts`.
2. Merge actions from `src/actions/root/requests/neupid/actions.ts` into `src/actions/root/requests/neupid.ts`.
3. Update all related pages and components to use the consolidated action files.

---

### Step 6: Standardize Page-Specific Actions

**Instruction:** "Refactor Step 6: Ensure all page-specific server actions are co-located with their pages."

**Goal:** Improve developer experience by placing server actions used by only one page directly within that page's directory. This is the opposite of centralization and is done for code that is not reusable.

**Tasks:**
1. For pages like `/manage/security/email`, `/manage/people/family`, etc., ensure the `actions.ts` file resides within the same directory.
2. Verify that no other part of the app incorrectly imports these non-reusable actions.

---

### Step 7: Create a Shared `icons.tsx` Component

**Instruction:** "Refactor Step 7: Create a shared `icons.tsx` component."

**Goal:** Avoid direct imports from `lucide-react` in every component. This allows for easier swapping of icon libraries or custom icons in the future.

**Tasks:**
1. Create a new file `src/components/icons.tsx`.
2. Re-export all used icons from `lucide-react` from this single file.
3. Update all components to import their icons from `src/components/icons.tsx` instead of directly from the library.

---

### Step 8: Abstract Repetitive UI Patterns into Components

**Instruction:** "Refactor Step 8: Abstract the `FeatureListItem` and `ActionListItem` UI patterns into reusable components."

**Goal:** Reduce UI code duplication on dashboard and settings pages.

**Tasks:**
1. Create a generic `ListItem` component that can handle icons, titles, descriptions, and navigation.
2. Refactor pages like `/manage/data/page.tsx`, `/manage/security/page.tsx`, and `/manage/people/page.tsx` to use this new shared component.

---

### Step 9: Clean Up Type Definitions

**Instruction:** "Refactor Step 9: Consolidate shared type definitions."

**Goal:** Create a single source of truth for common data shapes used throughout the app.

**Tasks:**
1. Create a `src/types.ts` file.
2. Move shared types like `UserSession`, `Application`, `Permission`, etc., into this file.
3. Remove duplicated type definitions from individual action files and components.

---

### Step 10: Final Code Review and Cleanup

**Instruction:** "Refactor Step 10: Perform a final code review and cleanup."

**Goal:** Catch any remaining inconsistencies, remove unused imports, and format the entire codebase.

**Tasks:**
1. Review all files for unused variables and imports.
2. Ensure consistent naming conventions for files, functions, and variables.
3. Auto-format all `.ts` and `.tsx` files to ensure consistent style.


src/app/manage/accounts/brand/create/actions.ts
remove from here and move the file to actions page.

src/app/manage/accounts/dependent/create/action.ts
src/app/manage/accounts/dependent/create/schema.ts
move it to @/schemas and @/actions

src/app/manage/access/action.ts
src/app/manage/people/family/action.ts
src/app/manage/people/invitations/action.ts
src/app/manage/root/users/[id]/action.ts
