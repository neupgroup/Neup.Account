# Authentication Integration Guide

This guide provides the technical specification for integrating your application (Internal or External) with the **Neup.Account** authentication ecosystem.

---

## **1. Application Definitions**

| Type | Definition |
| :--- | :--- |
| **Internal Apps** | Applications developed by the **Neup Group**. |
| **External Apps** | Applications developed by **other users**, regardless of the domain they reside on. |

---

## **2. External Applications**

External applications interact with Neup.Account primarily through the **"Sign"** endpoint. This single endpoint handles the entire handshake, sign-in, and sign-up flow.

### **The "Sign" Process**
External apps perform a POST request to exchange credentials (received via a secure handshake) for a session.

**Endpoint:** `POST https://neupgroup.com/account/bridge/api.v1/auth/sign`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "auth_account_id": "...",
  "auth_session_id": "...",
  "auth_session_key": "..."
}
```

**Response Properties:**
- `sessionValue`: A unique token the external app should use for its own session management. Once this token is obtained, the app does not need to call other Neup endpoints for basic session maintenance.
- `activeTill`: Expiration date for the `sessionValue`.
- `user`: Object containing `accountId`, `displayName`, `displayImage`, and `permissions`.
- `isNewSignup`: Boolean indicating if this is the user's first time authorizing this app.
---

## **3. Internal Applications**

Internal applications use different methods to obtain and verify session information based on their domain.

### **Obtaining Session Information**
- **Same Domain (`neupgroup.com`)**: Session information is automatically available via secure HTTP-only cookies (`auth_account_id`, `auth_session_id`, `auth_session_key`).
- **Different Domain**: Internal apps must use the `POST https://neupgroup.com/account/bridge/api.v1/auth/sign` endpoint to obtain session details, similar to external apps.

### **Verification via gRPC**
Internal apps do **not** use REST endpoints (like `/verify`) for session validation. Instead, they use **gRPC** for high-performance, low-latency verification directly with the authentication service.

*(Specific gRPC service definitions and connection details are provided in the internal developer portal.)*

---

## **4. Signout Implementation**

When a user logs out from your application, notify Neup.Account to revoke the mapping.

**Endpoint:** `POST https://neupgroup.com/account/bridge/api.v1/auth/signout`

**Request Body:**
```json
{
  "appId": "YOUR_APP_ID",
  "sessionValue": "YOUR_APP_SESSION_TOKEN"
}
```

---

## **5. Data Persistence Requirements**

All applications **must** maintain a local copy of core user data to ensure resilience if the authentication service is unreachable.

### **Required Fields**
- `account_id`: (Primary Key/Unique) The Neup `accountId`.
- `display_name`: The user's chosen display name.
- `display_image`: URL to the user's profile photo.
- `neup_id`: The unique Neup identity string.

### **Example Database Schema (PostgreSQL)**
```sql
CREATE TABLE users (
    account_id VARCHAR(255) PRIMARY KEY, -- Neup accountId
    display_name VARCHAR(255),
    display_image TEXT,
    neup_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## **6. Security Best Practices**

- **Server-to-Server Only**: All calls to the bridge API (`/sign`, `/signout`) **must** be performed from your server.
- **Session Cascading**: If a user logs out of Neup.Account, all associated `sessionValue` tokens are automatically revoked.
- **Token Storage**: Store the `sessionValue` securely (e.g., in an HTTP-only cookie).
