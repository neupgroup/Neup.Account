# gRPC Implementation Guide

This guide explains how to verify a NeupID user session from another application using the gRPC `AuthService`.

---

## When to use gRPC

Use gRPC when your app is a **trusted internal backend** that needs to verify a user's identity with low latency. It is a direct backend-to-backend call — never call it from browser JavaScript.

Use the REST `whoisthis` endpoint instead if your app is browser-based or cross-origin. See the REST section at the bottom of this guide.

---

## How it works

```
Browser / Client
      │
      │  sends auth cookies (same domain) or session triplet
      ▼
Your App Server
      │
      │  calls gRPC Verify with { sessionId, sessionKey, accountId }
      ▼
NeupID gRPC Server (port 50051)
      │
      │  validates session, returns user identity
      ▼
Your App Server
      │
      │  uses accountId / neupId to identify the user
      ▼
Your Business Logic
```

---

## The proto definition

Copy this file into your project at any path you prefer (e.g. `src/proto/auth.proto`):

```proto
syntax = "proto3";

package auth;

service AuthService {
  rpc Verify (VerifyRequest) returns (VerifyResponse);
}

message VerifyRequest {
  string sessionId = 1;
  string sessionKey = 2;
  string accountId = 3;
}

message User {
  string accountId = 1;
  string neupId = 2;
  string displayName = 3;
  string displayImage = 4;
  string accountType = 5;
  bool verified = 6;
}

message VerifyResponse {
  bool valid = 1;
  string error = 2;
  User user = 3;
}
```

---

## Server address

The gRPC server binds on:

- **Host:** internal/private network host running Neup.Account
- **Port:** `50051` (default) or the value of the `GRPC_PORT` environment variable
- **Transport:** insecure (no TLS) — keep this on a private trusted network

---

## Where the session triplet comes from

Your app needs three values to call `Verify`:

| Field | Cookie name (same-domain) | Description |
|---|---|---|
| `accountId` | `auth_accounts[].aid` | The user's account ID |
| `sessionId` | `auth_accounts[].sid` | The session ID |
| `sessionKey` | `auth_accounts[].skey` | The session key |

These are stored in the `auth_accounts` JSON cookie set by Neup.Account. On a same-domain server you can read them directly. Never expose `sessionKey` to the browser.

---

## Node.js / TypeScript implementation

### 1. Install dependencies

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

### 2. Create the gRPC client

```ts
// src/lib/neupid-grpc.ts

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve(process.cwd(), 'src/proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = (grpc.loadPackageDefinition(packageDefinition) as any).auth;

// Replace with your actual internal host
const NEUPID_GRPC_HOST = process.env.NEUPID_GRPC_HOST || 'neupid-internal:50051';

export const authClient = new authProto.AuthService(
  NEUPID_GRPC_HOST,
  grpc.credentials.createInsecure()
);
```

### 3. Create a typed verify helper

```ts
// src/lib/verify-session.ts

import { authClient } from './neupid-grpc';

export type NeupUser = {
  accountId: string;
  neupId: string;
  displayName: string;
  displayImage: string;
  accountType: string;
  verified: boolean;
};

export type VerifyResult =
  | { valid: true; user: NeupUser }
  | { valid: false; error: string };

export function verifySession(input: {
  sessionId: string;
  sessionKey: string;
  accountId: string;
}): Promise<VerifyResult> {
  return new Promise((resolve) => {
    authClient.Verify(input, (err: Error | null, response: any) => {
      if (err) {
        resolve({ valid: false, error: err.message });
        return;
      }

      if (response.valid) {
        resolve({ valid: true, user: response.user });
      } else {
        resolve({ valid: false, error: response.error || 'invalid_session' });
      }
    });
  });
}
```

### 4. Use it in a route handler

```ts
// Example: Express route
import { verifySession } from '../lib/verify-session';

app.get('/dashboard', async (req, res) => {
  // Read the session triplet from cookies your server received
  const sessionId = req.cookies['auth_sid'];
  const sessionKey = req.cookies['auth_skey'];
  const accountId = req.cookies['auth_aid'];

  const result = await verifySession({ sessionId, sessionKey, accountId });

  if (!result.valid) {
    return res.status(401).json({ error: result.error });
  }

  // result.user is now available
  console.log(result.user.accountId);  // "acct_abc123"
  console.log(result.user.neupId);     // "jane.doe"
  console.log(result.user.displayName); // "Jane Doe"
  console.log(result.user.verified);   // true

  res.json({ user: result.user });
});
```

---

## Python implementation

### 1. Install dependencies

```bash
pip install grpcio grpcio-tools
```

### 2. Generate the client from the proto

```bash
python -m grpc_tools.protoc \
  -I./proto \
  --python_out=./src \
  --grpc_python_out=./src \
  ./proto/auth.proto
```

### 3. Use the generated client

```python
import grpc
import auth_pb2
import auth_pb2_grpc

channel = grpc.insecure_channel('neupid-internal:50051')
stub = auth_pb2_grpc.AuthServiceStub(channel)

response = stub.Verify(auth_pb2.VerifyRequest(
    sessionId='sess_abc',
    sessionKey='key_abc',
    accountId='acct_abc',
))

if response.valid:
    print(response.user.accountId)
    print(response.user.neupId)
    print(response.user.displayName)
else:
    print('Invalid session:', response.error)
```

---

## Go implementation

### 1. Install dependencies

```bash
go get google.golang.org/grpc
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

### 2. Generate the client

```bash
protoc --go_out=. --go-grpc_out=. proto/auth.proto
```

### 3. Use the generated client

```go
package main

import (
    "context"
    "log"

    "google.golang.org/grpc"
    pb "your-module/proto/auth"
)

func main() {
    conn, err := grpc.Dial("neupid-internal:50051", grpc.WithInsecure())
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    client := pb.NewAuthServiceClient(conn)

    resp, err := client.Verify(context.Background(), &pb.VerifyRequest{
        SessionId:  "sess_abc",
        SessionKey: "key_abc",
        AccountId:  "acct_abc",
    })
    if err != nil {
        log.Fatal(err)
    }

    if resp.Valid {
        log.Printf("AccountId: %s", resp.User.AccountId)
        log.Printf("NeupId: %s", resp.User.NeupId)
        log.Printf("DisplayName: %s", resp.User.DisplayName)
    } else {
        log.Printf("Invalid session: %s", resp.Error)
    }
}
```

---

## Response reference

### On success (`valid: true`)

```json
{
  "valid": true,
  "error": "",
  "user": {
    "accountId": "acct_abc123",
    "neupId": "jane.doe",
    "displayName": "Jane Doe",
    "displayImage": "https://neupcdn.com/photos/jane.jpg",
    "accountType": "individual",
    "verified": true
  }
}
```

### On failure (`valid: false`)

```json
{
  "valid": false,
  "error": "Invalid or expired session",
  "user": null
}
```

Possible error values:

| Error | Meaning |
|---|---|
| `Missing session credentials` | One or more of the three fields was empty |
| `Invalid or expired session` | Session not found, credentials mismatch, or session has expired |
| `Account not found` | The accountId does not exist |
| `This account is currently blocked` | Account is blocked permanently or temporarily |
| `internal_server_error` | Something went wrong on the NeupID side |

---

## Alternative: REST whoisthis endpoint

If your app is browser-based or cross-origin and cannot use gRPC, use the REST endpoint instead. It reads the NeupID session cookie directly from the browser request — no session triplet needed on your side.

**Endpoint:** `GET /bridge/api.v1/auth/whoisthis`

**Requirements:**
- The request must include cookies (`credentials: 'include'`)
- Your site's origin must be registered as an `authenticatesTo` URL for the resolved appId (matching by hostname)

**Browser usage:**

```js
const res = await fetch('https://neupid-domain.com/bridge/api.v1/auth/whoisthis', {
  method: 'GET',
  credentials: 'include',
});

const data = await res.json();

if (data.success) {
  console.log(data.accountId);   // "acct_abc123"
  console.log(data.neupId);      // "jane.doe"
  console.log(data.displayName); // "Jane Doe"
}
```

**Response shape** (same fields as gRPC `User`):

```json
{
  "success": true,
  "accountId": "acct_abc123",
  "neupId": "jane.doe",
  "displayName": "Jane Doe",
  "displayImage": "https://neupcdn.com/photos/jane.jpg",
  "accountType": "individual",
  "verified": true
}
```

---

## Security notes

- The gRPC server uses insecure credentials — keep it on a **private internal network**, never expose port `50051` to the public internet
- Never pass `sessionKey` to the browser or log it anywhere
- The `accountId` alone is not proof of identity — always verify the full triplet via gRPC or the REST endpoint
- For production, consider adding TLS to the gRPC server or putting it behind a private service mesh
