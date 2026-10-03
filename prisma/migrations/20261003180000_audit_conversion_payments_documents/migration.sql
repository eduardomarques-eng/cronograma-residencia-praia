-- Auditoria estruturada, conversão automática, parcelas e documentos comerciais
-- (Tópicos 36, 37, 38 e 39). Todas as mudanças são aditivas: nenhuma coluna
-- existente é removida ou reescrita, portanto o rollback é por descarte.

CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'PROPOSAL', 'CONTRACT', 'CONTRACT_SIGNED', 'PAYMENT_RECEIPT');

-- Tópico 36: quem fez, o quê, quando, qual versão e a transição de estado.
ALTER TABLE "AuditLog" ADD COLUMN "actorId" UUID;
ALTER TABLE "AuditLog" ADD COLUMN "actorRole" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "actorLabel" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entityVersion" INTEGER;
ALTER TABLE "AuditLog" ADD COLUMN "fromStatus" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "toStatus" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'SUCCESS';

CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_entityVersion_idx" ON "AuditLog"("entityVersion");

-- Tópico 39: documentos comerciais apontam para a proposta/contrato de origem.
ALTER TABLE "ProjectDocument" ADD COLUMN "source" "DocumentSource" NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "ProjectDocument" ADD COLUMN "proposalId" UUID;
ALTER TABLE "ProjectDocument" ADD COLUMN "contractId" UUID;
ALTER TABLE "ProjectDocument" ADD COLUMN "sourceKey" TEXT;

-- sourceKey é única e anulável: NULL significa "upload manual", que pode
-- repetir livremente; um valor preenchido impede duplicar o mesmo artefato.
CREATE UNIQUE INDEX "ProjectDocument_sourceKey_key" ON "ProjectDocument"("sourceKey");
CREATE INDEX "ProjectDocument_source_idx" ON "ProjectDocument"("source");

ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tópico 38: rastreabilidade e idempotência das parcelas geradas pela proposta.
ALTER TABLE "Payment" ADD COLUMN "sourceProposalId" UUID;
ALTER TABLE "Payment" ADD COLUMN "sourceKey" TEXT;

CREATE UNIQUE INDEX "Payment_sourceKey_key" ON "Payment"("sourceKey");
CREATE INDEX "Payment_sourceProposalId_idx" ON "Payment"("sourceProposalId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sourceProposalId_fkey"
  FOREIGN KEY ("sourceProposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tópico 37: marca de conversão. Gravada na mesma transação dos efeitos, para
-- que a conversão seja tudo-ou-nada e reexecutável com segurança.
ALTER TABLE "Proposal" ADD COLUMN "convertedAt" TIMESTAMP(3);
ALTER TABLE "Proposal" ADD COLUMN "conversionKey" TEXT;

CREATE UNIQUE INDEX "Proposal_conversionKey_key" ON "Proposal"("conversionKey");
