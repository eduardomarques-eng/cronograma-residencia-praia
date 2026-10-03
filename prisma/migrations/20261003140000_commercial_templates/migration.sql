-- Documentos do cliente usados pelo motor de contrato (Tópico 24)
ALTER TABLE "Client" ADD COLUMN "cpf" TEXT;
ALTER TABLE "Client" ADD COLUMN "rg" TEXT;
ALTER TABLE "Client" ADD COLUMN "city" TEXT;
ALTER TABLE "Client" ADD COLUMN "state" TEXT;

-- Templates de mensagem editáveis pelo ADMIN (Tópico 21)
CREATE TABLE "MessageTemplate" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");
CREATE INDEX "MessageTemplate_channel_active_idx" ON "MessageTemplate"("channel", "active");

-- Trilha de eventos para integrações futuras de e-mail, WhatsApp e internas (Tópico 22)
CREATE TABLE "NotificationEvent" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT,
    "recipient" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "payload" JSONB,
    "entityType" TEXT,
    "entityId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationEvent_type_occurredAt_idx" ON "NotificationEvent"("type", "occurredAt");
CREATE INDEX "NotificationEvent_entityType_entityId_idx" ON "NotificationEvent"("entityType", "entityId");
CREATE INDEX "NotificationEvent_status_occurredAt_idx" ON "NotificationEvent"("status", "occurredAt");

-- Motor de templates contratuais normalizado (Tópicos 24 e 25)
CREATE TABLE "ContractTemplate" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "clauses" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractTemplate_active_isDefault_idx" ON "ContractTemplate"("active", "isDefault");

-- Rastreabilidade: o contrato guarda o template e a versão usados
ALTER TABLE "Contract" ADD COLUMN "templateId" UUID;
ALTER TABLE "Contract" ADD COLUMN "templateVersion" INTEGER;

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;