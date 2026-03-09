# Neup.Account Integration & SSO Guide (Internal)

This guide describes how to integrate **Internal** applications (developed by Neup Group) into the Neup ecosystem.

---

## 1. Application Definitions

- **Internal Apps**: Developed by **Neup Group**.
- **External Apps**: Developed by **other users**, regardless of domain.

---

## 2. Obtaining Session Information

Internal applications obtain session information based on their domain:

### Same Domain (`neupgroup.com`)
Internal apps on the same domain share secure HTTP-only cookies:
- `auth_account_id`
- `auth_session_id`
- `auth_session_key`

### Different Domain
Internal apps on different domains must use the **"Sign"** endpoint:

**Endpoint:** `POST https://neupgroup.com/account/bridge/api.v1/auth/sign`

**Request Body:**
```json
{
  "appId": "YOUR_INTERNAL_APP_ID",
  "appType": "internal",
  "auth_account_id": "...",
  "auth_session_id": "...",
  "auth_session_key": "..."
}
```

---

## 3. High-Performance Verification (gRPC)

Internal applications **do not** use REST endpoints for session verification. Instead, they use **gRPC** for maximum performance and low latency.

### gRPC Service Definition
The `AuthService` provides a `VerifySession` method:

```proto
service AuthService {
  rpc VerifySession (VerifyRequest) returns (VerifyResponse);
}
```

### Implementation
1.  **Handshake**: Obtain the `auth_*` credentials from cookies or the `/sign` endpoint.
2.  **Verify**: Call the gRPC `VerifySession` method with these credentials.
3.  **Local Sync**: If verification is successful, ensure the user data is synchronized with your local database.

---

## 4. Data Persistence & Constraints (Mandatory)

Regardless of app type, you **must** maintain a local copy of core user data.

### Required Fields
- `account_id`: (Primary Key/Unique) The Neup `accountId`.
- `display_name`: Cached name.
- `display_image`: Cached photo URL.
- `neup_id`: The user's Neup identity string.

### Recommended Schema (PostgreSQL)
```sql
CREATE TABLE users (
    account_id VARCHAR(255) PRIMARY KEY, -- Neup accountId
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
