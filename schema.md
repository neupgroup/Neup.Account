# Database Schema (Live)
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