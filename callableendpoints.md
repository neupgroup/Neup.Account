# Callable Endpoints

This document lists all gRPC and Bridge endpoints in the system, along with their purposes.

---

## gRPC Endpoints

### AuthService
- **VerifySession**
  - **Path:** `AuthService.VerifySession`
  - **Request:**
    - `appId`: Application ID
    - `auth_account_id`: Account ID
    - `auth_session_id`: Session ID
    - `auth_session_key`: Session key
  - **Response:**
    - `success`: Boolean
    - `error`: Error message (if any)
    - `user`: User info (accountId, displayName, neupId)
  - **Purpose:**
    - Validates an internal session for a given application and user. Returns user info if the session is valid, or an error if not.

---

## Bridge Endpoints

### /api.v1/
- **/api.v1/auth/session** — Session management (create, validate, or revoke sessions)
- **/api.v1/auth/grant** — Grant authentication or permissions
- **/api.v1/auth/sign** — Sign in or sign up
- **/api.v1/auth/switch** — Switch between user accounts or sessions
- **/api.v1/auth/signout** — Sign out of a session
- **/api.v1/auth/refresh** — Refresh authentication tokens or sessions
- **/api.v1/auth/access** — Access control or permission checks
- **/api.v1/auth/verify** — Verify authentication (e.g., 2FA, email, phone)
- **/api.v1/permissions** — Query or update user permissions
- **/api.v1/profile** — Get or update user profile
- **/api.v1/profile/public** — Public profile information
- **/api.v1/profile/signed** — Signed-in user profile information

### /handshake.v1/
- **/handshake.v1/auth/grant** — Grant authentication or permissions via handshake protocol

### /webhook.v1/
- **/webhook.v1** — Receive webhook events from external services

---

*This file is auto-generated. Update as endpoints change or expand.*
