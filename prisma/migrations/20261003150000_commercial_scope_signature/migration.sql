-- Contratos por disciplina/escopo (Tópico 26)
ALTER TABLE "ContractTemplate" ADD COLUMN "scopeKey" TEXT;
ALTER TABLE "ContractTemplate" ADD COLUMN "disciplines" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Assinatura digital desacoplada (Tópico 27)
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TABLE "ContractSignature" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "signatoryName" TEXT NOT NULL,
    "signatoryEmail" TEXT,
    "signatoryPhone" TEXT,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractSignature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractSignature_contractId_key" ON "ContractSignature"("contractId");
CREATE INDEX "ContractSignature_status_updatedAt_idx" ON "ContractSignature"("status", "updatedAt");

ALTER TABLE "ContractSignature" ADD CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;