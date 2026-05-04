# Expected Database Schema
## Account based Tables
table: account
  id: text, primary key, default uuid()
  displayName: text
  accountType: text, default 'individual'
  displayImage: text
  status: text
  isVerified: boolean, default false
  details: jsonb
  createdAt: timestamp, default now()


table: account_meta__individual
  accountId: text, primary key, references account.id
  firstName: text
  middleName: text
  lastName: text
  dateOfBirth: timestamp
  countryOfResidence: text
  details: json[]
  roleId: text, references authz_role.id -> add this column


table: account_meta__brand
  accountId: text, primary key, references account.id
  brandName: text
  isLegalEntity: boolean, default false
  originCountry: text
  details: json[]


## NeupID Table
table: neupid 
  id: text, primary key
  accountId: text, references account.id
  neupId: text, unique
  isPrimary: boolean, default false
  dateAdded: timestamp, default now()


## Contact Information Tables
table: contact
  id: text, primary key, default uuid()
  accountId: text, references account.id
  contactType: text
  value: text


## Authentication Tables
table: auth_method -> rename to authn_method (Model name: AuthnMethod)
  id: text, primary key, default uuid()
  accountId: text, references account.id
  value: text
  type: text
  order: text
  status: text
  detail: jsonb


table: auth_request -> rename to authn_request (Model name: AuthnRequest)
  id: text, primary key, default uuid()
  type: text
  status: text, default 'pending'
  data: jsonb, default '{}'
  accountId: text
  createdAt: timestamp, default now()
  expiresAt: timestamp


table: auth_session -> rename to authn_session (Model name: AuthnSession)
  id: text, primary key, default uuid()
  accountId: text, references account.id
  key: text
  ipAddress: text
  userAgent: text
  validTill: timestamp
  lastLoggedIn: timestamp
  loginType: text
  geolocation: text
  deviceType: text


## Activity Table
table: activity
  id: text, primary key, default uuid()
  target_account_id: text
  actor_account_id: text
  action: text
  status: text
  ip: text
  timestamp: timestamp, default now()
  geolocation: text


## Notification Table
table: notification
  id: text, primary key, default uuid()
  account_id: text, references account.id
  action: text
  title: text
  message: text
  type: text, default 'info'
  read: boolean, default false
  created_at: timestamp, default now()
  deletable_on: timestamp
  persistence: text
  request_id: text, references request.id -> drop this column.
  detail: jsonb -> in this column we will add things like if the user was invited or something like so, request_id, deletable_on will be stored in here.


## Request Table
table: request
  id: text, primary key, default uuid()
  senderId: text, references account.id
  recipient_id: text, references account.id
  status: text, default 'pending'
  action: text
  type: text
  data: jsonb, default '{}'
  created_at: timestamp, default now()
  updated_at: timestamp, updatedAt


## Family Table
table: families -> rename the table to "family" (Model name: Family)
  id: text, primary key, default uuid()
  created_by: text, references account.id
  member_ids: array -> drop this column.
  members: jsonb -> drop this column.
  created_at: timestamp, default now()
  updated_at: timestamp, updatedAt -> drop this column.


table: family_member (Model name: FamilyMember) -> make this table
  id: text, primary key, default uuid()
  family_id: text, references family.id
  member_id: text, references account.id
  role: text, default 'member'|'owner'|'parent'|'child'


## Verification Table
table: verification
  id: text, primary key, default uuid()
  account_id: text, references account.id
  status: text, default 'pending'
  reason: text
  category: text
  done_by: text, references account.id
  done_at: timestamp, default now()
  previously: enum(attempted|disqualified|cancelled|verified) 


## Application Section
table: application
  id: text, primary key
  name: text
  party: text, default 'third' -> drop this column.
  isInternal: boolean, default false
  description: text
  icon: text
  website: text
  developer: text
  appSecret: text
  created_at: timestamp, default now()
  details: jsonb [defautlPermission, ]
  endpoints -> jsonb [denormalized saving]
  status: text, default 'development'


table: application_policies -> make this table.
  id: text, primary key, default uuid()
  app_id: text, references application.id
  policy_type: text
  policy_value: jsonb
  created_at: timestamp, default now()
  index: (appId, policyType)

table: application_connection
  id: text, primary key, default uuid()
  account_id: text, references account.id
  app_id: text, references application.id
  connected_at: timestamp, default now()
  unique: (accountId, appId)

table: application_bridge
  id: text, primary key, default uuid()
  app_id: text, references application.id
  type: text
  value: text
  details: jsonb
  created_at: timestamp, default now()
  index: (appId, type)


## Permission and Role
table: permission -> change it to authz_capability (Model name: AuthzCapability)
  id: text, primary key, default uuid()
  name: text
  description: text
  isRoot: boolean, default false -> drop this column.
  app_id: text, references application.id
  scope -> string (global/account/resource) -> add this column.


table: authz_role (Model name: AuthzRole)
  id: text, primary key, default uuid()
  name: text
  account_id: text, references account.id -> drop this column.
  permissions: array -> denormalization for faster access.
  description: text
  app_id: text, references application.id
  scope -> string (global/account/resource) -> add this column.


table: role_capability_map -> rename to authz_role_capability_map (Model name: AuthzRoleCapabilityMap)
  id: text, primary key, default uuid()
  role_id: text, references role.id
  capability_id: text, references capability.id


table: account_access_grant -> rename to authz_account_access_grant (Model name: AuthzAccountAccessGrant)
  id: text, primary key, default uuid() -> index, not nullable
  owner_account_id: string, references account.id -> index, not nullable
  target_account_id: string, references account.id -> index, not nullable
  role_id: string, references role.id -> index, not nullable
  app_id: string, references application.id -> index, not nullable
  portfolio_id: string, references portfolio.id -> nullable;

table: assets_access_grant (Model name: AuthzAssetsAccessGrant)
  id: text, primary key, default uuid() -> index, not nullable
  assetId -> string, portfolio_assets.id
  target_account_id: string, references account.id -> index, not nullable.
  role_id: string, references role.id -> index, not nullable.
  portfolio_id: string, references portfolio.id -> index, not nullable.


## Portfolio Tables
table: portfolio
  id: text, primary key, default uuid()
  name: text
  description: text
  dateCreated: timestamp, default now()

table: portfolio_asset
  id: text, primary key, default uuid()
  portfolioId: text, references portfolio.id
  assetType: text
  assetId: text
  details: jsonb

table: portfolio_member
  id: text, primary key, default uuid()
  portfolioId: text, references portfolio.id
  accountId: text, references account.id
  details: jsonb


## System specific Table  
table: system_error
  id: text, primary key, default uuid()
  message: text
  context: text
  timestamp: timestamp, default now()
  accountId: text, references account.id
  geolocation: text
  ipAddress: text


table: system_config
  key: text, primary key
  data: jsonb
  updatedAt: timestamp, default now(), updatedAt


# Database (Live)

## Database Schema (Live)
Snapshot source: live Postgres (`public` schema) introspection on 2026-05-04.

```text
# _prisma_migrations
- id : varchar NOT NULL
- checksum : varchar NOT NULL
- finished_at : timestamptz
- migration_name : varchar NOT NULL
- logs : text
- rolled_back_at : timestamptz
- started_at : timestamptz NOT NULL DEFAULT now()
- applied_steps_count : int4 NOT NULL DEFAULT 0

# account
- id : text NOT NULL
- displayName : text
- accountType : text NOT NULL DEFAULT 'individual'::text
- displayImage : text
- status : text
- isVerified : bool NOT NULL DEFAULT false
- details : jsonb
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# account_meta__brand
- accountId : text NOT NULL
- brandName : text
- dateCreated : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- isLegalEntity : bool NOT NULL DEFAULT false
- originCountry : text

# account_meta__individual
- accountId : text NOT NULL
- firstName : text
- middleName : text
- lastName : text
- dateOfBirth : timestamp
- countryOfResidence : text

# account_ownership
- id : text NOT NULL
- parentId : text NOT NULL
- childrenId : text NOT NULL
- type : text NOT NULL

# activity
- id : text NOT NULL
- targetAccountId : text NOT NULL
- actorAccountId : text NOT NULL
- action : text NOT NULL
- status : text NOT NULL
- ip : text NOT NULL
- timestamp : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- geolocation : text

# application
- id : text NOT NULL
- name : text NOT NULL
- party : text NOT NULL DEFAULT 'third'::text
- description : text
- icon : text
- website : text
- developer : text
- appSecret : text
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- access : jsonb
- endpoints : jsonb
- ownerAccountId : text
- policies : jsonb
- status : text NOT NULL DEFAULT 'development'::text

# application_bridge
- id : text NOT NULL
- appId : text NOT NULL
- type : text NOT NULL
- value : text NOT NULL
- details : jsonb
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# application_connection
- id : text NOT NULL
- accountId : text NOT NULL
- appId : text NOT NULL
- connectedAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# auth_method
- accountId : text NOT NULL
- value : text NOT NULL
- id : text NOT NULL
- type : text NOT NULL
- order : text NOT NULL
- status : text NOT NULL
- detail : jsonb

# auth_request
- id : text NOT NULL
- type : text NOT NULL
- status : text NOT NULL DEFAULT 'pending'::text
- data : jsonb NOT NULL DEFAULT '{}'::jsonb
- accountId : text
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- expiresAt : timestamp NOT NULL

# auth_session
- id : text NOT NULL
- accountId : text NOT NULL
- key : text
- ipAddress : text NOT NULL
- userAgent : text NOT NULL
- validTill : timestamp
- lastLoggedIn : timestamp NOT NULL
- loginType : text NOT NULL
- geolocation : text
- deviceType : text

# contact
- id : text NOT NULL
- accountId : text NOT NULL
- contactType : text NOT NULL
- value : text NOT NULL

# families
- id : text NOT NULL
- createdBy : text NOT NULL
- memberIds : _text
- members : jsonb NOT NULL
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- updatedAt : timestamp NOT NULL

# neupid
- id : text NOT NULL
- accountId : text NOT NULL
- isPrimary : bool NOT NULL DEFAULT false
- dateAdded : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# notification
- id : text NOT NULL
- accountId : text NOT NULL
- action : text
- title : text
- message : text
- type : text NOT NULL DEFAULT 'info'::text
- read : bool NOT NULL DEFAULT false
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- deletableOn : timestamp
- persistence : text
- requestId : text

# permit
- id : text NOT NULL
- accountId : text NOT NULL
- targetAccountId : text
- forSelf : bool NOT NULL DEFAULT false
- isRoot : bool NOT NULL DEFAULT false
- permissions : _text
- restrictions : _text
- createdOn : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- expiryDate : timestamp
- fullAccess : bool NOT NULL DEFAULT false
- issueDate : timestamp
- issuingAuthority : text
- managedBy : text
- permitNumber : text
- permitSubType : text
- permitType : text
- status : text NOT NULL DEFAULT 'active'::text

# portfolio
- id : text NOT NULL
- name : text NOT NULL
- description : text
- dateCreated : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# portfolio_asset
- id : text NOT NULL
- portfolioId : text NOT NULL
- assetType : text NOT NULL
- assetId : text NOT NULL
- details : jsonb

# portfolio_member
- id : text NOT NULL
- portfolioId : text NOT NULL
- accountId : text NOT NULL
- details : jsonb

# portfolio_role
- id : text NOT NULL
- accountId : text NOT NULL
- portfolioId : text NOT NULL
- roleId : text NOT NULL
- details : jsonb

# request
- id : text NOT NULL
- senderId : text NOT NULL
- recipientId : text NOT NULL
- status : text NOT NULL DEFAULT 'pending'::text
- action : text NOT NULL
- type : text
- data : jsonb DEFAULT '{}'::jsonb
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- updatedAt : timestamp NOT NULL

# system_config
- key : text NOT NULL
- data : jsonb NOT NULL
- updatedAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP

# system_error
- id : text NOT NULL
- message : text NOT NULL
- context : text NOT NULL
- timestamp : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- accountId : text
- geolocation : text
- ipAddress : text
- problemLevel : text
- reproSteps : text
- solution : text
- solvedBy : text
- status : text NOT NULL DEFAULT 'new'::text
- type : text NOT NULL

# verification
- id : text NOT NULL
- accountId : text NOT NULL
- type : text NOT NULL
- token : text
- code : text
- status : text NOT NULL DEFAULT 'pending'::text
- reason : text
- category : text
- verifiedBy : text
- revokedBy : text
- revocationReason : text
- createdAt : timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
- verifiedAt : timestamp
- revokedAt : timestamp
```

## Prisma Schema
Snapshot source: `prisma/schema.prisma` (repo working tree).

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client"
}

datasource db {
  provider = "postgresql"
}

model Account {
  id                String                  @id(map: "accounts_pkey") @default(uuid())
  displayName       String?
  accountType       String                  @default("individual")
  displayImage      String?
  status            String?
  isVerified        Boolean                 @default(false)
  details           Json?
  createdAt         DateTime                @default(now())
  brandProfile      AccountTypeBrand?
  individualProfile AccountTypeIndividual?
  childOwnerships   AccountOwnership[]      @relation("AccountOwnershipChild")
  parentOwnerships  AccountOwnership[]      @relation("AccountOwnershipParent")
  ownedApplications Application[]
  appConnections    ApplicationConnection[]
  authMethods       AuthMethod[]
  sessions          AuthSession[]
  contacts          Contact[]
  neupIds           NeupId[]
  notifications     Notification[]
  portfolioMembers  PortfolioMember[]
  
  receivedRequests  Request[]               @relation("ReceivedRequests")
  sentRequests      Request[]               @relation("SentRequests")
  errorLogs         SystemError[]
  verifications     Verification[]

  @@map("account")
}

model AccountTypeIndividual {
  accountId          String    @id @unique(map: "account_type__individual_accountId_key")
  firstName          String?
  middleName         String?
  lastName           String?
  dateOfBirth        DateTime?
  countryOfResidence String?
  details            Json?
  account            Account   @relation(fields: [accountId], references: [id], onDelete: Cascade, map: "account_type__individual_accountId_fkey")

  @@map("account_meta__individual")
}

model AccountTypeBrand {
  accountId     String   @id @unique(map: "account_type__brand_accountId_key")
  brandName     String?
  isLegalEntity Boolean  @default(false)
  originCountry String?
  details       Json?
  account       Account  @relation(fields: [accountId], references: [id], onDelete: Cascade, map: "account_type__brand_accountId_fkey")

  @@map("account_meta__brand")
}

model AccountOwnership {
  id         String  @id @default(uuid())
  parentId   String
  childrenId String
  type       String
  child      Account @relation("AccountOwnershipChild", fields: [childrenId], references: [id], onDelete: Cascade)
  parent     Account @relation("AccountOwnershipParent", fields: [parentId], references: [id], onDelete: Cascade)

  @@unique([parentId, childrenId, type])
  @@index([parentId])
  @@index([childrenId])
  @@map("account_ownership")
}

model SystemConfig {
  key       String   @id
  data      Json
  updatedAt DateTime @default(now()) @updatedAt

  @@map("system_config")
}

model AuthRequest {
  id        String   @id(map: "auth_requests_pkey") @default(uuid())
  type      String
  status    String   @default("pending")
  data      Json     @default("{}")
  accountId String?
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@map("auth_request")
}

model Activity {
  id              String   @id(map: "activity_logs_pkey") @default(uuid())
  targetAccountId String
  actorAccountId  String
  action          String
  status          String
  ip              String
  timestamp       DateTime @default(now())
  geolocation     String?

  @@map("activity")
}

model Notification {
  id          String    @id(map: "notifications_pkey") @default(uuid())
  accountId   String
  action      String?
  title       String?
  message     String?
  type        String    @default("info")
  read        Boolean   @default(false)
  createdAt   DateTime  @default(now())
  deletableOn DateTime?
  persistence String?
  requestId   String?
  account     Account   @relation(fields: [accountId], references: [id], map: "notifications_accountId_fkey")
  request     Request?  @relation(fields: [requestId], references: [id], map: "notifications_requestId_fkey")

  @@map("notification")
}

model Request {
  id            String         @id(map: "requests_pkey") @default(uuid())
  senderId      String
  recipientId   String
  status        String         @default("pending")
  action        String
  type          String?
  data          Json?          @default("{}")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  notifications Notification[]
  recipient     Account        @relation("ReceivedRequests", fields: [recipientId], references: [id], map: "requests_recipientId_fkey")
  sender        Account        @relation("SentRequests", fields: [senderId], references: [id], map: "requests_senderId_fkey")

  @@map("request")
}

model Family {
  id        String   @id @default(uuid())
  createdBy String
  memberIds String[]
  members   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("families")
}

model Verification {
  id               String    @id(map: "verifications_pkey") @default(uuid())
  accountId        String
  type             String
  token            String?
  code             String?
  status           String    @default("pending")
  reason           String?
  category         String?
  verifiedBy       String?
  revokedBy        String?
  revocationReason String?
  createdAt        DateTime  @default(now())
  verifiedAt       DateTime?
  revokedAt        DateTime?
  account          Account   @relation(fields: [accountId], references: [id], map: "verifications_accountId_fkey")

  @@map("verification")
}

model Contact {
  id          String  @id(map: "contacts_pkey") @default(uuid())
  accountId   String
  contactType String
  value       String
  account     Account @relation(fields: [accountId], references: [id], map: "contacts_accountId_fkey")

  @@map("contact")
}

model NeupId {
  id        String   @id(map: "neup_ids_pkey")
  accountId String
  isPrimary Boolean  @default(false)
  dateAdded DateTime @default(now())
  account   Account  @relation(fields: [accountId], references: [id], map: "neup_ids_accountId_fkey")

  @@map("neupid")
}

model AuthMethod {
  accountId         String
  value             String
  id                String  @id @default(uuid())
  type              String
  order             String
  status            String
  detail            Json?
  individualProfile Account @relation(fields: [accountId], references: [id], map: "passwords_accountId_fkey")

  @@unique([accountId, type, order])
  @@index([accountId])
  @@map("auth_method")
}


model AuthSession {
  id           String    @id(map: "sessions_pkey") @default(uuid())
  accountId    String
  key          String?
  ipAddress    String
  userAgent    String
  validTill    DateTime?
  lastLoggedIn DateTime
  loginType    String
  geolocation  String?
  deviceType   String?
  account      Account   @relation(fields: [accountId], references: [id], map: "sessions_accountId_fkey")

  @@map("auth_session")
}

model SystemError {
  id           String   @id(map: "error_logs_pkey") @default(uuid())
  message      String
  context      String
  timestamp    DateTime @default(now())
  accountId    String?
  geolocation  String?
  ipAddress    String?
  problemLevel String?
  reproSteps   String?
  solution     String?
  solvedBy     String?
  status       String   @default("new")
  type         String
  account      Account? @relation(fields: [accountId], references: [id], map: "error_logs_accountId_fkey")

  @@map("system_error")
}

model Application {
  id             String                  @id(map: "applications_pkey")
  name           String
  party          String                  @default("third")
  description    String?
  icon           String?
  website        String?
  developer      String?
  appSecret      String?
  createdAt      DateTime                @default(now())
  access         Json?
  endpoints      Json?
  ownerAccountId String?
  policies       Json?
  status         String                  @default("development")
  owner          Account?                @relation(fields: [ownerAccountId], references: [id], map: "applications_ownerAccountId_fkey")
  connections    ApplicationConnection[]
  bridge         ApplicationBridge[]

  @@map("application")
}

model Portfolio {
  id          String            @id @default(uuid())
  name        String
  description String?
  dateCreated DateTime          @default(now())
  assets      PortfolioAsset[]
  members     PortfolioMember[]
  

  @@map("portfolio")
}

model PortfolioAsset {
  id          String    @id(map: "portfolio_assets_pkey") @default(uuid())
  portfolioId String
  assetType   String
  assetId     String
  details     Json?
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade, map: "portfolio_assets_portfolioId_fkey")

  @@index([assetType, assetId], map: "portfolio_assets_assetType_assetId_idx")
  @@index([portfolioId], map: "portfolio_assets_portfolioId_idx")
  @@map("portfolio_asset")
}

model PortfolioMember {
  id          String    @id(map: "portfolio_members_pkey") @default(uuid())
  portfolioId String
  accountId   String
  details     Json?
  account     Account   @relation(fields: [accountId], references: [id], onDelete: Cascade, map: "portfolio_members_accountId_fkey")
  portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade, map: "portfolio_members_portfolioId_fkey")

  @@unique([portfolioId, accountId], map: "portfolio_members_portfolioId_accountId_key")
  @@index([accountId], map: "portfolio_members_accountId_idx")
  @@index([portfolioId], map: "portfolio_members_portfolioId_idx")
  @@map("portfolio_member")
}



model ApplicationConnection {
  id          String      @id(map: "user_app_connections_pkey") @default(uuid())
  accountId   String
  appId       String
  connectedAt DateTime    @default(now())
  account     Account     @relation(fields: [accountId], references: [id], map: "user_app_connections_accountId_fkey")
  application Application @relation(fields: [appId], references: [id], map: "user_app_connections_appId_fkey")

  @@unique([accountId, appId], map: "user_app_connections_accountId_appId_key")
  @@map("application_connection")
}

model ApplicationBridge {
  id          String      @id @default(uuid())
  appId       String
  type        String
  value       String
  details     Json?
  createdAt   DateTime    @default(now())
  application Application @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@index([appId, type])
  @@map("application_bridge")
}

model Role {
  id           String   @id @default(uuid())
  name         String
  capabilities String[]
  description  String?
  appId        String?
  scope        String?
  accesses     Access[]

  application  Application? @relation(fields: [appId], references: [id], map: "roles_appId_fkey")

  @@map("role")
}

model Capability {
  id          String    @id @default(uuid())
  name        String
  description String?
  appId       String?
  scope       String?
  accesses    Access[]

  application Application? @relation(fields: [appId], references: [id], map: "capabilities_appId_fkey")

  @@map("capability")
}

model RoleCapabilityMap {
  id           String @id @default(uuid())
  roleId       String
  capabilityId String
  role         Role   @relation(fields: [roleId], references: [id], map: "role_capability_map_roleId_fkey")
  capability   Capability @relation(fields: [capabilityId], references: [id], map: "role_capability_map_capabilityId_fkey")

  @@map("role_capability_map")
}

model Access {
  id           String     @id @default(uuid())
  accountId    String
  capabilityId String
  recipientId  String
  expiresAt    DateTime?
  status       String     @default("active")
  portfolioId  String?
  account      Account    @relation(fields: [accountId], references: [id], map: "access_accountId_fkey")
  recipient    Account    @relation(fields: [recipientId], references: [id], map: "access_recipientId_fkey")
  capability   Capability @relation(fields: [capabilityId], references: [id], map: "access_capabilityId_fkey")
  portfolio    Portfolio? @relation(fields: [portfolioId], references: [id], map: "access_portfolioId_fkey")

  @@map("access")
}

model AccountAccessGrant {
  id               String  @id @default(uuid())
  ownerAccountId   String
  targetAccountId  String
  roleId           String
  appId            String
  portfolioId      String?

  owner            Account @relation("GrantOwner", fields: [ownerAccountId], references: [id], map: "account_access_grant_ownerAccountId_fkey")
  target           Account @relation("GrantTarget", fields: [targetAccountId], references: [id], map: "account_access_grant_targetAccountId_fkey")
  role             Role    @relation(fields: [roleId], references: [id], map: "account_access_grant_roleId_fkey")
  application      Application @relation(fields: [appId], references: [id], map: "account_access_grant_appId_fkey")

  @@index([ownerAccountId])
  @@index([targetAccountId])
  @@index([roleId])
  @@index([appId])
  @@map("account_access_grant")
}
```


# Divergences

## Live Database -> Expected Database Schema
- (done) `account`: `id` has no DEFAULT in live DB; expected default `uuid()`.
- (done) `account_meta__individual`: missing `details` and `roleId` columns.
- (done) `account_meta__brand`: has extra `dateCreated`; missing `details`.
- (done) `neupid`: missing `neupId` column + UNIQUE; `id` has no DEFAULT in live DB.
- (done) `contact`: `id` has no DEFAULT in live DB.
- (done) `auth_method`: table needs rename to `authn_method`; `id` has no DEFAULT in live DB.
- (done) `auth_request`: table needs rename to `authn_request`; `id` has no DEFAULT in live DB.
- (done) `auth_session`: table needs rename to `authn_session`; `id` has no DEFAULT in live DB.
- (done) `activity`: column names differ (`targetAccountId`/`actorAccountId` vs expected `target_account_id`/`actor_account_id`); `id` has no DEFAULT in live DB.
- (done) `notification`: column names differ (`accountId`/`createdAt`/`deletableOn`/`requestId` vs expected `account_id`/`created_at`/`deletable_on`/`request_id`); missing `detail`; expected drops `request_id` and stores it inside `detail`.
- (done) `request`: column names differ (`recipientId`/`createdAt`/`updatedAt` vs expected `recipient_id`/`created_at`/`updated_at`).
- (done) `families`: table needs rename to `family`; drop `memberIds`, `members`, `updatedAt`; rename `createdBy` -> `created_by` and `createdAt` -> `created_at`; add `family_member` table.
- (done) `verification`: live schema has many extra columns (e.g. `type`, `token`, `code`, `verifiedBy`, `revokedBy`, `createdAt`, etc.) and is missing expected columns (`done_by`, `done_at`, `previously` enum); also `accountId` needs rename to `account_id`.
- (done) `application`: expected drops `party` and `ownerAccountId`, adds `isInternal`, renames `createdAt` -> `created_at`, and expects `details` instead of `access`/`policies`.
- (done) `application_connection`: rename `accountId` -> `account_id`, `appId` -> `app_id`, `connectedAt` -> `connected_at`.
- (done) `application_bridge`: rename `appId` -> `app_id`, `createdAt` -> `created_at`.
- (done) Missing expected tables: `application_policies`, `authz_capability`, `authz_role`, `authz_role_capability_map`, `authz_account_access_grant`, `assets_access_grant`.
- (done) Extra live tables not described in expected schema: `permit`, `portfolio_role`, `account_ownership` (expected does not list them).
- (done) `portfolio`/`portfolio_asset`/`portfolio_member`: `id` columns have no DEFAULT in live DB; expected default `uuid()`.
- (done) `system_error`: live has extra columns (`problemLevel`, `reproSteps`, `solution`, `solvedBy`, `status`, `type`); `id` has no DEFAULT in live DB.
- (done) `system_config`: `updatedAt` is not auto-updating in live DB (no trigger/default behavior equivalent to Prisma `@updatedAt`).

## Prisma Schema -> Expected Database Schema
- Naming: Prisma still maps to `auth_method`/`auth_request`/`auth_session` and `families`; expected wants `authn_*` tables and `family`.
- `AccountTypeIndividual`/`AccountTypeBrand`: Prisma has `details Json?`, but live DB currently has no `details` column; expected wants `details: json[]`.
- `NeupId`: Prisma is missing expected `neupId` field.
- `Notification`: Prisma uses `requestId` relation; expected removes `request_id` column and stores that in `detail`.
- `Verification`: Prisma model does not match expected columns (`done_by`, `done_at`, `previously`) and includes many live-only fields.
- Authz/permission models: Prisma defines `Role`/`Capability`/`RoleCapabilityMap`/`Access`/`AccountAccessGrant` (non-`authz_*`), but expected schema wants `authz_capability`, `authz_role`, `authz_role_capability_map`, `authz_account_access_grant`, plus `assets_access_grant`.
- Prisma contains `AccountOwnership` and relations on `Account`; expected schema does not list `account_ownership`.
