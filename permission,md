# Account Module

## table 1.
table: account
fields: id, accountType, displayImage, displayName, status, isVerified, createdAt, details
## ==

## table 2.
table: account_neupid
fields: id, accountId, neupid, dateAdded, isPrimary
accountId -> accounts(id)
## ==

## table 3.
table: account_type__individual
fields: id, accountId, firstName, middleName, lastName, dateOfBirth, countryOfResidence
accountId -> accounts(id)
## ==

## table 4. 
table: account_type__brand
fields: id, accountId, brandName, dateCreated, isLegalEntity, originCountry
accountId -> accounts(id)
## ==

## table 5.
table: account_ownership
fields: id, parentId, childrenId, type
- type:brand/dependent/branch
- childrenId -> accounts(id)
- parentId -> accounts(id)
- Example: A brand account can have multiple branch accounts, and a dependent account can be owned by an individual account. The ownership type will indicate the relationship between the parent and child accounts.
## ==

## table 6.
table: account_contacts
fields: id, accountId, contactType, contactValue, isPrimary, dateAdded
- contactType: email/phone/socialMedia/contactAccount/recoveryAccount
- accountId -> accounts(id)
- - contactAccount -> accounts(id) (if contactType is contactAccount)
- - recoveryAccount -> accounts(id) (if contactType is recoveryAccount)
## ==

# Permit Module
## table 1.
table: roles
fields: id, name, permissions, description
## ==

## table 2.
table: permissions
fields: id, name, description
## ==


# Portfolio Module
## table 1.
table: portfolio
fields: id, name, description, dateCreated
## ==

## table 2.
table: portfolio_assets
fields: id, portfolioId, assetType, assetId, details {isPermanent, removesOn, primaryPortfolio}
- assetType: brandAccount/individualAccount/otherPortfolio/tourio/ledger/application
- portfolioId -> portfolio(id)
## ==
  

## table 3.
table: portfolio_members
fields: id, portfolioId, accountId, details {isPermanent, removesOn, hasFullAccess}
- portfolioId -> portfolio(id)
- accountId -> accounts(id)
## ==

## table 4.
table: portfolio_role
fields: id, accountId, portfolioId, roleId, details {}
- accountId -> accounts(id)
- portfolioId -> portfolio(id)
- roleId -> roles(id)
## ==

# Activity Module
## table 1.
table: activity
fields: id, activityOn, activityBy, action, app, timestamp, details {}
- activityOn -> accounts(id)
- activityBy -> accounts(id)
