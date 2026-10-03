-- Versão aprovada congelada da proposta (Tópico 23)
ALTER TABLE "Proposal" ADD COLUMN "approvedVersion" INTEGER;

-- Estado final: proposta convertida em serviço (CONVERTIDA_EM_SERVIÇO)
ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'CONVERTED';

-- Contrato gerado a partir de uma proposta aprovada
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'READY', 'SENT', 'VIEWED', 'SIGNED', 'CANCELLED');

CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signatureMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");
CREATE INDEX "Contract_status_updatedAt_idx" ON "Contract"("status", "updatedAt");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
