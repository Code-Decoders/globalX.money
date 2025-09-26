-- CreateEnum
CREATE TYPE "public"."RecipientType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('SAVINGS', 'CURRENT', 'NRE', 'NRO', 'OTHER');

-- CreateTable
CREATE TABLE "public"."Recipient" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "type" "public"."RecipientType" NOT NULL,
    "firstName" VARCHAR(120),
    "lastName" VARCHAR(120),
    "businessName" VARCHAR(200),
    "email" VARCHAR(160),
    "phone" VARCHAR(60),
    "accountNumber" VARCHAR(64) NOT NULL,
    "ifsc" VARCHAR(20) NOT NULL,
    "bankName" VARCHAR(160) NOT NULL,
    "accountHolder" VARCHAR(160) NOT NULL,
    "branch" VARCHAR(160),
    "accountType" "public"."AccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipient_walletAddress_idx" ON "public"."Recipient"("walletAddress");
