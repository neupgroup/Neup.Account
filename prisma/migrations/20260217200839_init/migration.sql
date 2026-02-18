-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "nameFirst" TEXT,
    "nameMiddle" TEXT,
    "nameLast" TEXT,
    "nameDisplay" TEXT,
    "displayName" TEXT,
    "accountPhoto" TEXT,
    "gender" TEXT,
    "dateBirth" TIMESTAMP(3),
    "dateCreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nationality" TEXT,
    "isLegalEntity" BOOLEAN NOT NULL DEFAULT false,
    "nameLegal" TEXT,
    "registrationId" TEXT,
    "countryOfOrigin" TEXT,
    "dateEstablished" TIMESTAMP(3),
    "neupIdPrimary" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "accountType" TEXT NOT NULL DEFAULT 'individual',
    "accountStatus" TEXT,
    "block" JSONB,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contactType" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neup_ids" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "neup_ids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_passwords" (
    "accountId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "passwordLastChanged" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_passwords_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "permits" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "forSelf" BOOLEAN NOT NULL DEFAULT false,
    "isRoot" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],
    "restrictions" TEXT[],
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appId" TEXT,
    "access" TEXT[],

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neup_ids" ADD CONSTRAINT "neup_ids_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_passwords" ADD CONSTRAINT "auth_passwords_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
