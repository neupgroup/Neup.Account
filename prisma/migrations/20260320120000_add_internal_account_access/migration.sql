-- CreateTable
CREATE TABLE "account_access" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL DEFAULT '__app__',
    "parentOwnerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_members" (
    "id" TEXT NOT NULL,
    "parentOwnerId" TEXT NOT NULL,
    "memberAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_access_accountId_appId_resourceId_parentOwnerId_key" ON "account_access"("accountId", "appId", "resourceId", "parentOwnerId");

-- CreateIndex
CREATE INDEX "account_access_accountId_appId_status_idx" ON "account_access"("accountId", "appId", "status");

-- CreateIndex
CREATE INDEX "account_access_parentOwnerId_appId_status_idx" ON "account_access"("parentOwnerId", "appId", "status");

-- CreateIndex
CREATE INDEX "account_access_appId_resourceId_status_idx" ON "account_access"("appId", "resourceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "access_members_parentOwnerId_memberAccountId_key" ON "access_members"("parentOwnerId", "memberAccountId");

-- CreateIndex
CREATE INDEX "access_members_memberAccountId_status_idx" ON "access_members"("memberAccountId", "status");

-- CreateIndex
CREATE INDEX "access_members_parentOwnerId_status_idx" ON "access_members"("parentOwnerId", "status");

-- AddForeignKey
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_appId_fkey" FOREIGN KEY ("appId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_access" ADD CONSTRAINT "account_access_parentOwnerId_fkey" FOREIGN KEY ("parentOwnerId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_members" ADD CONSTRAINT "access_members_parentOwnerId_fkey" FOREIGN KEY ("parentOwnerId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_members" ADD CONSTRAINT "access_members_memberAccountId_fkey" FOREIGN KEY ("memberAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
