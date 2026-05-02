# Database Schema (Live)

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
  role: text -> add this table.


table: account_meta__brand
  accountId: text, primary key, references account.id
  brandName: text
  isLegalEntity: boolean, default false
  originCountry: text
  details: json[]

table: contact
  id: text, primary key, default uuid()
  accountId: text, references account.id
  contactType: text
  value: text

table: auth_method
  id: text, primary key, default uuid()
  accountId: text, references account.id
  value: text
  type: text
  order: text
  status: text
  detail: jsonb
  unique: (accountId, type, order)
  index: (accountId)

table: auth_request
  id: text, primary key, default uuid()
  type: text
  status: text, default 'pending'
  data: jsonb, default '{}'
  accountId: text
  createdAt: timestamp, default now()
  expiresAt: timestamp

table: auth_session
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

table: activity
  id: text, primary key, default uuid()
  targetAccountId: text
  actorAccountId: text
  action: text
  status: text
  ip: text
  timestamp: timestamp, default now()
  geolocation: text

table: system_config
  key: text, primary key
  data: jsonb
  updatedAt: timestamp, default now(), updatedAt

table: notification
  id: text, primary key, default uuid()
  accountId: text, references account.id
  action: text
  title: text
  message: text
  type: text, default 'info'
  read: boolean, default false
  createdAt: timestamp, default now()
  deletableOn: timestamp
  persistence: text
  requestId: text, references request.id

table: request
  id: text, primary key, default uuid()
  senderId: text, references account.id
  recipientId: text, references account.id
  status: text, default 'pending'
  action: text
  type: text
  data: jsonb, default '{}'
  createdAt: timestamp, default now()
  updatedAt: timestamp, updatedAt

table: families
  id: text, primary key, default uuid()
  createdBy: text
  memberIds: array
  members: jsonb
  createdAt: timestamp, default now()
  updatedAt: timestamp, updatedAt

table: verification
  id: text, primary key, default uuid()
  accountId: text, references account.id
  type: text
  token: text
  code: text
  status: text, default 'pending'
  reason: text
  category: text
  verifiedBy: text
  revokedBy: text
  revocationReason: text
  createdAt: timestamp, default now()
  verifiedAt: timestamp
  revokedAt: timestamp

table: neupid
  id: text, primary key
  accountId: text, references account.id
  isPrimary: boolean, default false
  dateAdded: timestamp, default now()

table: permit
  id: text, primary key, default uuid()
  accountId: text, references account.id
  targetAccountId: text, references account.id
  forSelf: boolean, default false
  isRoot: boolean, default false
  permissions: array
  restrictions: array
  createdOn: timestamp, default now()
  expiryDate: timestamp
  fullAccess: boolean, default false
  issueDate: timestamp
  issuingAuthority: text
  managedBy: text
  permitNumber: text
  permitSubType: text
  permitType: text
  status: text, default 'active'

table: system_error
  id: text, primary key, default uuid()
  message: text
  context: text
  timestamp: timestamp, default now()
  accountId: text, references account.id
  geolocation: text
  ipAddress: text
  problemLevel: text
  reproSteps: text
  solution: text
  solvedBy: text
  status: text, default 'new'
  type: text

table: application
  id: text, primary key
  name: text
  party: text, default 'third'
  description: text
  icon: text
  website: text
  developer: text
  appSecret: text
  createdAt: timestamp, default now()
  access: jsonb
  endpoints: jsonb
  ownerAccountId: text, references account.id
  policies: jsonb
  status: text, default 'development'

table: application_connection
  id: text, primary key, default uuid()
  accountId: text, references account.id
  appId: text, references application.id
  connectedAt: timestamp, default now()
  unique: (accountId, appId)

table: application_bridge
  id: text, primary key, default uuid()
  appId: text, references application.id
  type: text
  value: text
  details: jsonb
  createdAt: timestamp, default now()
  index: (appId, type)

table: permission
  id: text, primary key, default uuid()
  name: text
  description: text
  isRoot: boolean, default false

table: role
  id: text, primary key, default uuid()
  name: text
  accountId: text, references account.id
  permissions: array
  description: text

table: role_calculated
  id: text, primary key, default uuid()
  roleId: text, references role.id
  permissionId: text, references permission.id
  hasRoot: boolean, default false

table: access
  id: text, primary key, default uuid()
  accountId: text, references account.id
  permissionId: text, references permission.id
  recipientId: text, references account.id
  expiresAt: timestamp, nullable
  status: text, default 'active'
  portfolioId: text, references portfolio.id, nullable

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
  indexes: (portfolioId), (assetType, assetId)

table: portfolio_member
  id: text, primary key, default uuid()
  portfolioId: text, references portfolio.id
  accountId: text, references account.id
  details: jsonb
  unique: (portfolioId, accountId)
  indexes: (portfolioId), (accountId)

table: portfolio_role
  id: text, primary key, default uuid()
  accountId: text, references account.id
  portfolioId: text, references portfolio.id
  roleId: text
  details: jsonb
  unique: (accountId, portfolioId, roleId)
  indexes: (accountId), (portfolioId), (roleId)
