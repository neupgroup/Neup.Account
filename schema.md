# Database Schema (Live)

table: account
  id: text, primary key
  displayName: text
  accountType: text, default 'individual'
  displayImage: text
  status: text
  isVerified: boolean, default false
  details: jsonb
  createdAt: timestamp, default CURRENT_TIMESTAMP
  role: text, references -> roles.id (add this column)

table: account_meta__individual
  accountId: text, primary key, references account.id
  firstName: text
  middleName: text
  lastName: text
  dateOfBirth: timestamp
  countryOfResidence: text

table: account_meta__brand
  accountId: text, primary key, references account.id
  brandName: text
  dateCreated: timestamp, default CURRENT_TIMESTAMP
  isLegalEntity: boolean, default false
  originCountry: text

table: contact
  id: text, primary key
  accountId: text, references account.id
  contactType: text
  value: text

table: auth_method
  id: text, primary key
  accountId: text, references account.id
  value: text
  type: text
  order: text
  status: text
  detail: jsonb

table: auth_request
  id: text, primary key
  type: text
  status: text, default 'pending'
  data: jsonb, default '{}'
  accountId: text
  createdAt: timestamp, default CURRENT_TIMESTAMP
  expiresAt: timestamp

table: auth_session
  id: text, primary key
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
  id: text, primary key
  targetAccountId: text
  actorAccountId: text
  action: text
  status: text
  ip: text
  timestamp: timestamp, default CURRENT_TIMESTAMP
  geolocation: text

table: account_roles
  id: text, primary key
  accountId: text, references account.id
  role: string



table: application
  id: text, primary key
  name: text
  party: text, default 'third'
  description: text
  icon: text
  website: text
  developer: text
  appSecret: text
  createdAt: timestamp, default CURRENT_TIMESTAMP
  access: jsonb
  endpoints: jsonb
  ownerAccountId: text, references account.id
  policies: jsonb
  status: text, default 'development'

table: application_connection
  id: text, primary key
  accountId: text, references account.id
  appId: text, references application.id
  connectedAt: timestamp, default CURRENT_TIMESTAMP


table: families
  id: text, primary key
  createdBy: text
  memberIds: array
  members: jsonb
  createdAt: timestamp, default CURRENT_TIMESTAMP
  updatedAt: timestamp

table: neupid
  id: text, primary key
  accountId: text, references account.id
  isPrimary: boolean, default false
  dateAdded: timestamp, default CURRENT_TIMESTAMP

table: notification
  id: text, primary key
  accountId: text, references account.id
  action: text
  title: text
  message: text
  type: text, default 'info'
  read: boolean, default false
  createdAt: timestamp, default CURRENT_TIMESTAMP
  deletableOn: timestamp
  persistence: text
  requestId: text, references request.id

table: permit
  id: text, primary key
  accountId: text, references account.id
  targetAccountId: text, references account.id
  forSelf: boolean, default false
  isRoot: boolean, default false
  permissions: array
  restrictions: array
  createdOn: timestamp, default CURRENT_TIMESTAMP
  expiryDate: timestamp
  fullAccess: boolean, default false
  issueDate: timestamp
  issuingAuthority: text
  managedBy: text
  permitNumber: text
  permitSubType: text
  permitType: text
  status: text, default 'active'

table: portfolio
  id: text, primary key
  name: text
  description: text
  dateCreated: timestamp, default CURRENT_TIMESTAMP

table: portfolio_asset
  id: text, primary key
  portfolioId: text, references portfolio.id
  assetType: text
  assetId: text
  details: jsonb

table: portfolio_member
  id: text, primary key
  portfolioId: text, references portfolio.id
  accountId: text, references account.id
  details: jsonb

table: portfolio_role
  id: text, primary key
  accountId: text, references account.id
  portfolioId: text, references portfolio.id
  roleId: text
  details: jsonb

table: request
  id: text, primary key
  senderId: text, references account.id
  recipientId: text, references account.id
  status: text, default 'pending'
  action: text
  type: text
  data: jsonb, default '{}'
  createdAt: timestamp, default CURRENT_TIMESTAMP
  updatedAt: timestamp

table: system_config
  key: text, primary key
  data: jsonb
  updatedAt: timestamp, default CURRENT_TIMESTAMP

table: system_error
  id: text, primary key
  message: text
  context: text
  timestamp: timestamp, default CURRENT_TIMESTAMP
  accountId: text, references account.id
  geolocation: text
  ipAddress: text
  problemLevel: text
  reproSteps: text
  solution: text
  solvedBy: text
  status: text, default 'new'
  type: text

table: verification
  id: text, primary key
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
  createdAt: timestamp, default CURRENT_TIMESTAMP
  verifiedAt: timestamp
  revokedAt: timestamp
