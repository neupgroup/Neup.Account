
# Sample Database Schema for User Permissions

This document outlines a sample relational database schema that models the user and permission system used in this application. This demonstrates how the NoSQL Firestore collections can be represented in a traditional SQL-like structure.

## Table Definitions

### 1. `users`

Stores the core information for each user account. This combines concepts from the `account` and `profile` Firestore collections.

| Column          | Type          | Description                               |
| --------------- | ------------- | ----------------------------------------- |
| `id`            | VARCHAR(255)  | Primary Key, the unique account ID.       |
| `neup_id`       | VARCHAR(255)  | The user's primary, unique username.      |
| `display_name`  | VARCHAR(255)  | The user's public display name.           |
| `email`         | VARCHAR(255)  | The user's primary email address.         |
| `created_at`    | TIMESTAMP     | When the user account was created.        |
| `status`        | VARCHAR(255)  | Current status of the account (e.g., `active`, `deletion_requested`). Nullable. |
| `pro`           | BOOLEAN       | Whether the user has a Pro subscription.  |


### 2. `permission_sets`

Stores the named groups of permissions, like "Admin" or "Standard User". This is equivalent to the `permission` collection in Firestore.

| Column          | Type          | Description                                     |
| --------------- | ------------- | ----------------------------------------------- |
| `id`            | VARCHAR(255)  | Primary Key, the unique ID for the set.         |
| `name`          | VARCHAR(255)  | The unique name of the set (e.g., `admin`).     |
| `description`   | TEXT          | A brief description of the permission set's purpose. |

### 3. `permissions`

A master list of every individual permission string available in the system.

| Column          | Type          | Description                                         |
| --------------- | ------------- | --------------------------------------------------- |
| `id`            | VARCHAR(255)  | Primary Key, the permission string itself.          |
| `description`   | TEXT          | A brief description of what the permission allows.  |

### 4. `user_permission_sets` (Junction Table)

Links users to their assigned permission sets. This is the equivalent of the `permit` collection.

| Column              | Type          | Description                                     |
| ------------------- | ------------- | ----------------------------------------------- |
| `user_id`           | VARCHAR(255)  | Foreign Key, references `users.id`.             |
| `permission_set_id` | VARCHAR(255)  | Foreign Key, references `permission_sets.id`.   |

### 5. `permission_set_items` (Junction Table)

Links permission sets to the individual permissions they contain. This represents the `access` array in the Firestore `permission` documents.

| Column              | Type          | Description                                     |
| ------------------- | ------------- | ----------------------------------------------- |
| `permission_set_id` | VARCHAR(255)  | Foreign Key, references `permission_sets.id`.   |
| `permission_id`     | VARCHAR(255)  | Foreign Key, references `permissions.id`.       |

### 6. `account_status`

A new table to log status changes for an account.

| Column          | Type          | Description                                     |
| --------------- | ------------- | ----------------------------------------------- |
| `id`            | VARCHAR(255)  | Primary Key for the log entry.                   |
| `account_id`    | VARCHAR(255)  | Foreign Key, references `users.id`.             |
| `status`        | VARCHAR(255)  | The status being applied (e.g., `deletion_requested`). |
| `remarks`       | TEXT          | Notes about why the status was applied.         |
| `from_date`     | TIMESTAMP     | The timestamp when the status was applied.      |
| `more_info`     | TEXT          | Additional details about the event.             |

### 7. `transactions`

Stores all financial transactions related to user accounts.

| Column                | Type          | Description                                     |
| --------------------- | ------------- | ----------------------------------------------- |
| `id`                  | VARCHAR(255)  | Primary Key for the transaction.                |
| `account_id`          | VARCHAR(255)  | Foreign Key, references `users.id`.             |
| `product`             | VARCHAR(255)  | The product purchased (e.g., `neup_pro`).       |
| `amount`              | DECIMAL(10,2) | The transaction amount.                         |
| `currency`            | VARCHAR(3)    | The currency of the transaction (e.g., `USD`).  |
| `payment_method`      | VARCHAR(255)  | The payment method used (e.g., `stripe_card`).  |
| `status`              | VARCHAR(255)  | Transaction status (e.g., `completed`, `failed`).|
| `transaction_date`    | TIMESTAMP     | The timestamp of the transaction.               |
| `subscription_start`  | TIMESTAMP     | Start date of the subscription period. Nullable.|
| `subscription_end`    | TIMESTAMP     | End date of the subscription period. Nullable.  |


## Sample Data

Here is some sample data to illustrate how an **Admin** and a **Standard User** would be set up.

### `users` table data
| id | neup_id | display_name | email | status |
|----|---------|--------------|-------|--------|
| `user_01` | `admin_user` | `Admin User` | `admin@example.com` | `active` |
| `user_02` | `standard_user` | `Standard User` | `user@example.com` | `active` |

### `permission_sets` table data
| id | name | description |
|----|------|-------------|
| `perm_set_admin` | `admin` | Grants full access to all system features. |
| `perm_set_standard` | `standard_user` | Grants access to standard, non-administrative features. |

### `permissions` table data (partial list)
| id | description |
|----|-------------|
| `profile.view` | Allows viewing user profiles. |
| `profile.modify`| Allows modifying user profiles. |
| `root.dashboard.view` | Allows viewing the admin dashboard. |
| `root.account.impersonate`| Allows an admin to impersonate another user. |

### `user_permission_sets` table data
| user_id | permission_set_id |
|---------|-------------------|
| `user_01` | `perm_set_admin` |
| `user_02` | `perm_set_standard` |

### `permission_set_items` table data
| permission_set_id | permission_id |
|-------------------|---------------|
| `perm_set_admin` | `profile.view` |
| `perm_set_admin` | `profile.modify` |
| `perm_set_admin` | `root.dashboard.view` |
| `perm_set_admin` | `root.account.impersonate` |
| `perm_set_standard` | `profile.view` |
| `perm_set_standard` | `profile.modify` |
