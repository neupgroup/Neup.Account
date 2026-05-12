# Design Document — Application Access Management

## Overview

This feature extends the existing `/data/applications` list page and `/data/applications/[id]` detail page to support role-based segmentation. The current implementation already handles "managed" (owner/developer) and "connected" (signed-in) apps but merges them into a flat list and does not expose a root-admin view. This design adds:

1. A segmented list page with "Using", "Development", and "Root" sections
2. A detail page that renders a read-only view for regular users and an editable view for root users
3. A new server action `updateApplicationInfo` for root-level metadata edits
4. A new `getApplicationsPageDataV2` aggregator that replaces `getApplicationsPageData`

No database schema changes are required. All new behaviour is implemented through new/updated service functions and page components.

---

## Architecture

```
app/(manage)/data/applications/
  page.tsx                          ← replaced: segmented list
  [id]/
    page.tsx                        ← extended: role-aware detail
    _components/
      application-info-edit-form.tsx  ← NEW: root edit form (client)

services/applications/
  form-actions.ts                   ← extended: getApplicationsPageDataV2, updateApplicationInfo
  manage.ts                         ← extended: getApplicationDetailsForViewerV2
  connected.ts                      ← unchanged
  types.ts                          ← extended: ApplicationSection, ApplicationDetailsV2
```

---

## Data Models

### New type: `ApplicationSection`

Added to `services/applications/types.ts`:

```ts
export type ApplicationSection = {
  label: 'Using' | 'Development' | 'Root';
  apps: FlatAppItem[];
  error?: boolean; // true when this section failed to load
};
```

`FlatAppItem` (already in `form-actions.ts`) gains one optional field:

```ts
export type FlatAppItem = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  source: 'managed' | 'connected' | 'root';
  status?: string;       // shown in Root section only
  connectedAt?: string;  // ISO string, shown in Using section
};
```

### New type: `ApplicationDetailsV2`

Added to `services/applications/types.ts`:

```ts
export type ApplicationDetailsV2 = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  website?: string;
  status?: string;
  isInternal: boolean;
  // User-facing fields
  connectedAt?: string;       // ISO string — present when user has an ApplicationConnection
  configuredAccess: ApplicationAccessField[];
  accessedData: string[];
  hasUsedApp: boolean;
  policies: ApplicationPolicyEntry[];
  endpoints: ApplicationEndpointConfig;
  // Access flags — never expose appSecret
  canEdit: boolean;           // true for app owner/developer
  isRootViewer: boolean;      // true when root.app.view permission held
  canDelete: boolean;         // true for app owner
};
```

---

## Service Layer

### `getApplicationsPageDataV2` — `services/applications/form-actions.ts`

Replaces `getApplicationsPageData`. Returns `ApplicationSection[]` instead of a flat list.

```ts
export async function getApplicationsPageDataV2(): Promise<{
  sections: ApplicationSection[];
  canCreateApplication: boolean;
  hasPartialError: boolean;
}>
```

**Algorithm:**

1. Resolve `personalAccountId` via `getPersonalAccountId()`. If null, return empty sections.
2. Run three independent queries in `Promise.allSettled`:
   - **Using**: `prisma.applicationConnection.findMany({ where: { accountId }, include: { application: true } })` — maps to `FlatAppItem[]` with `source: 'connected'` and `connectedAt`.
   - **Development**: `getManagedApplications()` — already returns apps where the user has an `authzAccountAccessGrant` view/edit/owner role. Maps to `FlatAppItem[]` with `source: 'managed'`.
   - **Root**: `checkPermissions(['root.app.view'])` → if true, `prisma.application.findMany({ orderBy: { createdAt: 'desc' } })` — maps to `FlatAppItem[]` with `source: 'root'` and `status`.
3. Build `sections` array — only include a section if it has apps OR is "Using" (always shown). Mark `error: true` on any section whose `allSettled` result was `rejected`.
4. Set `hasPartialError = sections.some(s => s.error)`.
5. `canCreateApplication = await checkPermissions(['root.app.create'])`.

### `getApplicationDetailsForViewerV2` — `services/applications/manage.ts`

Extends `getApplicationDetailsForViewer` to also resolve root access and `connectedAt`.

```ts
export async function getApplicationDetailsForViewerV2(
  appId: string
): Promise<ApplicationDetailsV2 | null>
```

**Algorithm:**

1. Resolve `activeAccountId` and `personalAccountId`.
2. Check `isRootViewer = await checkPermissions(['root.app.view'])`.
3. Fetch the application row (select all fields except `appSecret`).
4. If `!isRootViewer`: check `resolveApplicationAccessForAccount(activeAccountId, appId)`. If `!canView`, return `null`.
5. Fetch `ApplicationConnection` for `personalAccountId + appId` to get `connectedAt`.
6. Fetch `canDelete = await isApplicationOwnerForAccount(activeAccountId, appId)`.
7. Return `ApplicationDetailsV2` — `appSecret` is never included.

### `updateApplicationInfo` — `services/applications/form-actions.ts`

New server action for root-level metadata edits.

```ts
const updateApplicationInfoSchema = z.object({
  appId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name must be 120 characters or fewer.'),
  description: z.string().trim().max(1000, 'Description must be 1000 characters or fewer.').optional().or(z.literal('')),
  icon: z.string().trim().max(50).optional().or(z.literal('')),
  website: z.string().trim().max(500).url('Website must be a valid URL.').optional().or(z.literal('')),
  status: z.enum(['development', 'active', 'rejected', 'blocked']),
});

export async function updateApplicationInfo(
  input: z.infer<typeof updateApplicationInfoSchema>
): Promise<{ success: boolean; error?: string; fieldErrors?: Record<string, string> }>
```

**Algorithm:**

1. `checkPermissions(['root.app.edit'])` — return permission-denied if false.
2. `safeParse` the input — return `fieldErrors` if invalid.
3. `prisma.application.update({ where: { id }, data: { name, description, icon, website, status } })`.
4. `revalidatePath('/data/applications')` and `revalidatePath('/data/applications/${appId}')`.
5. Return `{ success: true }`.

---

## UI Components

### `app/(manage)/data/applications/page.tsx` — Segmented List

**Server component.** Calls `getApplicationsPageDataV2()`.

```
┌─────────────────────────────────────────┐
│ Applications                            │
│ Manage your applications and access.    │
│                              [Create]   │
├─────────────────────────────────────────┤
│ ⚠ Warning banner (if hasPartialError)  │
├─────────────────────────────────────────┤
│ Using                                   │
│ ┌─────────────────────────────────────┐ │
│ │ 🔲 App Name        @slug  →        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Development                             │
│ ┌─────────────────────────────────────┐ │
│ │ 🔲 My App          @id    →        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Root                          [badge]   │
│ ┌─────────────────────────────────────┐ │
│ │ 🔲 App A    active  →              │ │
│ │ 🔲 App B    blocked →              │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

- Each section renders a `<SectionList>` sub-component with its `label` and `apps`.
- The "Root" section heading includes a `<Badge variant="outline">Root</Badge>` label.
- Status badges in the Root section use colour-coded variants: `active` → `default`, `development` → `secondary`, `rejected`/`blocked` → `destructive`.
- Empty "Using" section shows: `<p>No connected applications yet.</p>`
- Partial error shows: `<Alert variant="warning">Some application data could not be loaded.</Alert>`

### `app/(manage)/data/applications/[id]/page.tsx` — Role-Aware Detail

**Server component.** Calls `getApplicationDetailsForViewerV2(id)`. Returns `notFound()` if null.

Renders two distinct layouts based on `details.isRootViewer`:

**Regular user layout** (existing layout, trimmed):
- App header (icon, name, description)
- Connection info card (if `connectedAt` present)
- Data Access card (read-only)
- Terms/Policies card (read-only)
- Account Actions card (logout/deletion links)
- No edit controls, no `appSecret`

**Root user layout** (new):
- App header (icon, name, description, status badge, isInternal badge)
- `<ApplicationInfoEditForm>` card — editable fields
- Connection info card (if `connectedAt` present)
- Data Access card (read-only)
- Terms/Policies card (read-only)
- Account Actions card
- AuthzManagementPanel (if `canDelete`)
- Silent SSO Origins card (if `canDelete`)
- Delete card (if `canDelete`)

### `app/(manage)/data/applications/_components/application-info-edit-form.tsx` — NEW

**Client component.** Receives initial values as props. Uses `react-hook-form` + `zod` + `useTransition`.

```ts
type Props = {
  appId: string;
  initialName: string;
  initialDescription?: string;
  initialIcon?: string;
  initialWebsite?: string;
  initialStatus: string;
};
```

Fields:
- `name` — `<Input>` — required, max 120
- `description` — `<Textarea>` — optional, max 1000
- `icon` — `<Input>` — optional (icon key string)
- `website` — `<Input type="url">` — optional, max 500
- `status` — `<Select>` with options: `development`, `active`, `rejected`, `blocked`

On submit: calls `updateApplicationInfo(data)`. Shows `useToast` on success/error. Displays `<FormMessage>` per field for validation errors.

---

## Permission Matrix

| Action | Permission required | Fallback |
|---|---|---|
| View list — Using section | authenticated session | empty section |
| View list — Development section | `authzAccountAccessGrant` with view/edit/owner role | section hidden |
| View list — Root section | `root.app.view` | section hidden |
| View detail — regular | `authzAccountAccessGrant` canView OR `ApplicationConnection` exists | `notFound()` |
| View detail — root | `root.app.view` | falls back to regular view |
| Edit application info | `root.app.edit` | permission-denied error |
| Create application | `root.app.create` | button hidden |
| Delete application | `application.owner` role on app | section hidden |

---

## Files Changed / Created

| File | Action | Notes |
|---|---|---|
| `services/applications/types.ts` | Modified | Add `ApplicationSection`, extend `FlatAppItem`, add `ApplicationDetailsV2` |
| `services/applications/form-actions.ts` | Modified | Add `getApplicationsPageDataV2`, `updateApplicationInfo` |
| `services/applications/manage.ts` | Modified | Add `getApplicationDetailsForViewerV2` |
| `app/(manage)/data/applications/page.tsx` | Replaced | Segmented list using `getApplicationsPageDataV2` |
| `app/(manage)/data/applications/[id]/page.tsx` | Modified | Role-aware layout using `getApplicationDetailsForViewerV2` |
| `app/(manage)/data/applications/_components/application-info-edit-form.tsx` | Created | Root edit form client component |

Existing files not changed: `connected.ts`, `authz-manage.ts`, `authz-webhook.ts`, `access.ts`, `application-management-panel.tsx`, `authz-management-panel.tsx`, `application-create-form.tsx`, `application-access-form.tsx`.
