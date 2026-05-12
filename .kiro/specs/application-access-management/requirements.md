# Requirements Document

## Introduction

This feature governs access control and display logic for the `/data/applications` list page and the `/data/applications/[id]` detail page. Two distinct user classes interact with these pages: regular users (who have connected to one or more applications via `ApplicationConnection`) and root users (who hold `root.app.view` or `root.app.edit` permissions). Regular users see only the applications they are connected to and may only read application details. Root users see all applications in the system and may edit application metadata such as name, description, icon, website, and status.

## Glossary

- **Application_List_Page**: The Next.js server-rendered page at `/data/applications`.
- **Application_Detail_Page**: The Next.js server-rendered page at `/data/applications/[id]`.
- **Application**: A record in the `application` table with fields: `id`, `name`, `description`, `icon`, `website`, `appSecret`, `createdAt`, `endpoints`, `status`, `isInternal`, `details`.
- **ApplicationConnection**: A record in the `application_connection` table linking an `accountId` to an `appId`, representing that the user has connected to that application.
- **Regular_User**: An authenticated account that does not hold any `root.app.*` permission.
- **Root_User**: An authenticated account that holds at least one of the permissions `root.app.view` or `root.app.edit`.
- **Permission_Service**: The `checkPermissions` server action in `services/user.ts` that returns a boolean indicating whether the active account holds all specified permissions.
- **Application_Service**: Server actions in `services/applications/` responsible for querying and mutating application data.
- **Edit_Form**: The inline or page-level UI component that allows a Root_User to modify application fields.
- **Connection_Info**: The `connectedAt` timestamp and `id` from the `ApplicationConnection` record for the current user and the given application.

---

## Requirements

### Requirement 1: Application List — Segmented View by User Role

**User Story:** As a user, I want the applications list page to show me the applications relevant to my role and relationship with each application, so that I can quickly navigate to the right context.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to `/data/applications`, THE Application_List_Page SHALL display one or more named sections, each containing application entries that match the user's relationship to those applications.
2. THE Application_List_Page SHALL always render a "Using" section containing `Application` records for which an `ApplicationConnection` exists with the current user's `accountId`.
3. WHEN a user holds an `authzAccountAccessGrant` with `appId` set to a specific application and a role scoped to that application, THE Application_List_Page SHALL render a "Development" section containing those applications.
4. WHEN a user holds `root.app.view` or `root.app.edit` permission, THE Application_List_Page SHALL render a "Root" section containing all `Application` records in the system.
5. WHEN a user has no `ApplicationConnection` records and no development or root access, THE Application_List_Page SHALL render only the "Using" section with a message indicating no connected applications are found.
6. THE Application_List_Page SHALL display each application entry's `name` and `icon`, falling back to a generic application placeholder icon when `icon` is null.
7. WHEN a database error occurs while loading applications, THE Application_List_Page SHALL display the sections that loaded successfully and SHALL display a warning banner indicating that some data may be unavailable.
8. WHEN an application qualifies for more than one section (e.g., a Root_User who is also connected to an app), THE Application_List_Page SHALL display that application in each applicable section without deduplication across sections.

---

### Requirement 2: Application List — Root Section Display

**User Story:** As a root user, I want the "Root" section of the applications list to show all registered applications with status information, so that I can monitor and manage the full application catalogue.

#### Acceptance Criteria

1. WHEN a Root_User views the Application_List_Page, THE Application_List_Page SHALL call `checkPermissions(['root.app.view'])` and, IF the check passes, SHALL query all `Application` records in the system regardless of their status.
2. THE Application_List_Page SHALL display each application's `name`, `icon` (falling back to the default application icon), and a status badge whose value is one of `development`, `active`, `rejected`, or `blocked` within the "Root" section.
3. WHEN a Root_User views the Application_List_Page, THE Application_List_Page SHALL render a visible section heading labelled "Root" to identify the administrative overview section.
4. IF no `Application` records exist in the system, THEN THE Application_List_Page SHALL render the "Root" section with a message indicating no applications are registered.

---

### Requirement 3: Application Detail — Regular User Access Control

**User Story:** As a regular user, I want to view the details of an application I am connected to or have access to, so that I can review connection information and application metadata.

#### Acceptance Criteria

1. WHEN a Regular_User navigates to `/data/applications/[id]` for an application with a matching `ApplicationConnection`, THE Application_Detail_Page SHALL display the application's `name`, `description`, `icon`, and `website` (when `website` is not null).
2. WHEN a Regular_User navigates to `/data/applications/[id]` for an application with a matching `ApplicationConnection`, THE Application_Detail_Page SHALL display the Connection_Info `connectedAt` value formatted as a human-readable date (e.g., "May 12, 2026").
3. WHEN a Regular_User navigates to `/data/applications/[id]` for an application with no matching `ApplicationConnection` and no development or root access, THE Application_Detail_Page SHALL display a read-only view showing only the application's `name`, `description`, `icon`, and `website` (when not null), without Connection_Info.
4. WHEN a Regular_User navigates to `/data/applications/[id]` for an application ID that does not exist in the database, THE Application_Detail_Page SHALL render a not-found page.
5. WHILE a Regular_User is viewing the Application_Detail_Page, THE Application_Detail_Page SHALL NOT render any input fields, save buttons, or edit form elements for application fields.
6. WHILE a Regular_User is viewing the Application_Detail_Page, THE Application_Detail_Page SHALL NOT include the application's `appSecret` value in the rendered HTML.

---

### Requirement 4: Application Detail — Root User Access Control

**User Story:** As a root user, I want to view and edit any application's details from the detail page, so that I can maintain accurate and up-to-date application information across the platform.

#### Acceptance Criteria

1. WHEN a Root_User navigates to `/data/applications/[id]` for any existing application, THE Application_Detail_Page SHALL display the application's `name`, `description`, `icon`, `website`, `status` (one of `development`, `active`, `rejected`, `blocked`), and `isInternal` flag.
2. WHEN a Root_User navigates to `/data/applications/[id]` for an application ID that does not exist in the database, THE Application_Detail_Page SHALL render a not-found page.
3. WHILE a Root_User is viewing the Application_Detail_Page, THE Application_Detail_Page SHALL render an Edit_Form with input fields for `name`, `description`, `icon`, `website`, and `status`.
4. WHEN a Root_User submits the Edit_Form with a `name` of 1–120 non-whitespace characters, a `website` of at most 500 characters that is a valid URL or empty, and a `status` from the allowed set, THE Application_Service SHALL update the `Application` record and revalidate cached data for `/data/applications` and `/data/applications/[id]`.
5. WHEN a Root_User submits the Edit_Form with any invalid field value, THE Application_Detail_Page SHALL display an error message identifying the invalid field without persisting any changes.
6. IF the database write fails during a valid Edit_Form submission, THEN THE Application_Service SHALL return an error response and THE Application_Detail_Page SHALL display an error message without partial data being committed.
7. WHILE a Root_User is viewing the Application_Detail_Page, THE Application_Detail_Page SHALL NOT include the application's `appSecret` value in the rendered HTML.

---

### Requirement 5: Permission Enforcement in Service Layer

**User Story:** As a system operator, I want all data access and mutation to be gated by server-side permission checks, so that client-side bypasses cannot expose or modify restricted data.

#### Acceptance Criteria

1. WHEN the Application_Service receives a list request from a Regular_User, THE Application_Service SHALL call `Permission_Service` to verify the session is authenticated and SHALL query only `Application` records linked to the user's `accountId` via `ApplicationConnection`.
2. WHEN the Application_Service receives a list request, IF `checkPermissions(['root.app.view'])` returns true, THEN THE Application_Service SHALL query all `Application` records.
3. WHEN the Application_Service receives an edit request, THE Application_Service SHALL call `checkPermissions(['root.app.edit'])`. IF the check returns false, THEN THE Application_Service SHALL return a permission-denied error without modifying any data.
4. IF the active session is unauthenticated, THEN THE Application_Service SHALL return a permission-denied error for both list and mutation requests.
5. THE Application_Service SHALL call `Permission_Service` on every request to authorize the operation, and SHALL NOT use any client-supplied role or permission values as the sole basis for authorization.

---

### Requirement 6: Application Edit — Field Validation

**User Story:** As a root user, I want the system to validate application fields before saving, so that invalid data is never persisted to the database.

#### Acceptance Criteria

1. WHEN a Root_User submits an edit with a `name` value exceeding 120 characters, THE Application_Service SHALL return a validation error with an error message indicating the name length constraint.
2. WHEN a Root_User submits an edit with a `website` value that is not a valid URL, THE Application_Service SHALL return a validation error with an error message indicating the website format constraint.
3. WHEN a Root_User submits an edit with a `status` value not in the set `['development', 'active', 'rejected', 'blocked']`, THE Application_Service SHALL return a validation error with an error message indicating the allowed status values.
4. WHEN a Root_User submits an edit with all fields valid and the database persistence succeeds, THE Application_Service SHALL persist the changes and return a success response.
5. IF the database persistence fails due to a technical error, THEN THE Application_Service SHALL return an error response without any partial data being committed.
6. WHEN a Root_User submits the Edit_Form, THE Application_Service SHALL trim leading and trailing whitespace from `name`, `description`, and `website` before validation and persistence.
7. WHEN a Root_User submits an edit where `name` is empty or contains only whitespace after trimming, THE Application_Service SHALL return a validation error with an error message indicating the name is required.
8. WHEN a Root_User submits an edit with a `description` value exceeding 1000 characters, THE Application_Service SHALL return a validation error with an error message indicating the description length constraint.
