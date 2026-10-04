-- Tópico 4A — Briefing profissional: referências visuais do cliente e
-- respostas por áudio.
--
-- ADITIVA E NÃO DESTRUTIVA. Não altera nem apaga nenhuma tabela ou coluna
-- existente: cria duas tabelas novas e um enum novo. `Briefing.responses`
-- continua a ser `jsonb` — a mudança de formato do conteúdo é tratada em código
-- (`src/lib/briefing-answers.ts`), com leitura do formato antigo.

CREATE TYPE "BriefingAudioStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'FAILED');

CREATE TABLE "BriefingReference" (
    "id" UUID NOT NULL,
    "briefingId" UUID NOT NULL,
    "questionId" TEXT NOT NULL,
    "storageKey" TEXT,
    "documentId" UUID,
    "visualOptionId" UUID,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "category" TEXT NOT NULL DEFAULT 'REFERENCIA',
    "likes" TEXT,
    "dislikes" TEXT,
    "environmentId" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "discarded" BOOLEAN NOT NULL DEFAULT false,
    "professionalNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BriefingAudioNote" (
    "id" UUID NOT NULL,
    "briefingId" UUID NOT NULL,
    "questionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "status" "BriefingAudioStatus" NOT NULL DEFAULT 'UPLOADED',
    "provider" TEXT,
    "transcript" TEXT,
    "reviewedText" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingAudioNote_pkey" PRIMARY KEY ("id")
);

-- Índices das leituras quentes: a página do briefing lista as referências por
-- categoria e as notas por pergunta.
CREATE INDEX "BriefingReference_briefingId_category_idx" ON "BriefingReference"("briefingId", "category");
CREATE INDEX "BriefingReference_briefingId_createdAt_idx" ON "BriefingReference"("briefingId", "createdAt");
CREATE INDEX "BriefingAudioNote_briefingId_questionId_idx" ON "BriefingAudioNote"("briefingId", "questionId");
CREATE INDEX "BriefingAudioNote_status_idx" ON "BriefingAudioNote"("status");

-- As chaves estrangeiras entram DEPOIS das tabelas: uma referência nunca fica
-- órfã de briefing, e um ficheiro apagado deixa a referência sem documento, não
-- apaga a resposta do cliente.
ALTER TABLE "BriefingReference"
    ADD CONSTRAINT "BriefingReference_briefingId_fkey"
    FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BriefingReference"
    ADD CONSTRAINT "BriefingReference_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "ProjectDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BriefingAudioNote"
    ADD CONSTRAINT "BriefingAudioNote_briefingId_fkey"
    FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;