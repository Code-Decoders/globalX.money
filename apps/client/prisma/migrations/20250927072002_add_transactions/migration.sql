-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'CLAIMED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."Transaction" (
    "id" TEXT NOT NULL,
    "senderWallet" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientEmail" VARCHAR(160),
    "recipientPhone" VARCHAR(60),
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "fromAmount" DECIMAL(18,2) NOT NULL,
    "currencyFrom" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "currencyTo" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "purpose" VARCHAR(280) NOT NULL,
    "quoteId" VARCHAR(120),
    "quoteSnapshot" JSONB,
    "quoteExpiresAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "gpsTransactionId" VARCHAR(160),
    "gpsResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_recipientId_idx" ON "public"."Transaction"("recipientId");

-- CreateIndex
CREATE INDEX "Transaction_senderWallet_idx" ON "public"."Transaction"("senderWallet");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "public"."Transaction"("status");
