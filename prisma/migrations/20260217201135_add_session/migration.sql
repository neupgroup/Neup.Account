-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "authSessionKey" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "expiresOn" TIMESTAMP(3) NOT NULL,
    "lastLoggedIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginType" TEXT NOT NULL,
    "geolocation" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
