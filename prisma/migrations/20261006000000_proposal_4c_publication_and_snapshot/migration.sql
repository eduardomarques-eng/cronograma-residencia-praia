-- FASE 4C — PROPOSTA: identificação, versão publicada e snapshot de preço.
--
-- Todas as mudanças são ADITIVAS: nenhuma coluna existente é removida, renomeada
-- ou reescrita. O rollback é por descarte e nenhuma migration anterior é tocada.
--
-- Contexto de cada mudança:
--
--  1. `ProposalStatus.NEGOTIATING`
--     O item 49 exige um estado para "o cliente pediu alteração". Antes, uma
--     negociação acabava ou em REJECTED (encerrando a oportunidade) ou em DRAFT
--     (perdendo o histórico do que foi enviado). O valor é inserido no enum
--     EXISTENTE, sem recriar o tipo — recriar `ProposalStatus` descartaria a
--     ordem dos valores e obrigaria a converter cada linha.

-- 1. Estado de negociação (item 49).
ALTER TYPE "ProposalStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATING';

-- 2. Identificação comercial (item 3).
--
--    NULL é permitido de propósito: propostas criadas antes desta fase continuam
--    válidas e legíveis. O índice é UNIQUE mas parcial não é necessário porque o
--    Postgres trata vários NULLs como distintos em índices únicos.
ALTER TABLE "Proposal" ADD COLUMN "code" TEXT;

-- 3. Versão e instante de publicação (itens 42 e 45).
--
--    `publishedVersion` + a nova `ProposalAccessLink.versionNumber` juntos fazem o
--    link público ser uma fotografia do que foi enviado. Ver o comentário da
--    coluna: sem `versionNumber`, o link mudava de conteúdo conforme o ADMIN
--    editava a proposta.
ALTER TABLE "Proposal" ADD COLUMN "publishedVersion" INTEGER;
ALTER TABLE "Proposal" ADD COLUMN "publishedAt" TIMESTAMP(3);

-- 4. Snapshot de preço (itens 23 e 24).
--
--    Congela o preço unitário, o nível e a origem de cada linha no momento em
--    que a versão é gravada. Alterar o catálogo depois NÃO pode alterar uma
--    proposta já enviada.
ALTER TABLE "Proposal" ADD COLUMN "pricingSnapshot" JSONB;

-- 5. Versão fixada no link público (item 42).
ALTER TABLE "ProposalAccessLink" ADD COLUMN "versionNumber" INTEGER;

-- Índices: um é a unicidade do código, o outro serve a leitura por versão.
CREATE UNIQUE INDEX "Proposal_code_key" ON "Proposal"("code");
CREATE INDEX "ProposalAccessLink_versionNumber_idx" ON "ProposalAccessLink"("versionNumber");

-- 6. Índice de apoio ao dashboard comercial (itens 70 e 71).
--
--    As métricas separam VALOR PROPOSTO de VALOR APROVADO por faixa de status.
--    Sem este índice, cada abertura do painel varre a proposta inteira e soma em
--    memória; o índice torna a agregação delegável ao banco.
CREATE INDEX "Proposal_status_currentVersion_idx" ON "Proposal"("status", "currentVersion");