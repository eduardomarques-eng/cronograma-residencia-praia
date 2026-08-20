-- ============================================================================
-- CRONOGRAMA ARQVERTICE — ESQUEMA POSTGRESQL
-- Aplicar uma vez na base nova:
--   psql "$DATABASE_URL" -f database/schema.sql
-- O script e idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FICHA TECNICA DA OBRA
-- Linha unica (id = 1). O CHECK garante que nunca exista uma segunda.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projeto (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nome_obra           TEXT NOT NULL DEFAULT 'Nova Obra',
    cliente             TEXT NOT NULL DEFAULT '',
    localizacao         TEXT NOT NULL DEFAULT '',
    lote_quadra         TEXT NOT NULL DEFAULT '',
    zona                TEXT NOT NULL DEFAULT '',
    area_construida     TEXT NOT NULL DEFAULT '',
    area_terreno        TEXT NOT NULL DEFAULT '',
    tipologia           TEXT NOT NULL DEFAULT '',
    data_inicio         TEXT NOT NULL DEFAULT '',
    previsao_conclusao  TEXT NOT NULL DEFAULT '',
    prazo_total         TEXT NOT NULL DEFAULT '',
    empresa             TEXT NOT NULL DEFAULT 'ArqVértice',
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. ETAPAS DO CRONOGRAMA
-- disciplina e projetista ficam como TEXT com CHECK em vez de ENUM: incluir
-- uma disciplina nova vira um ALTER simples, sem migrar tipo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas (
    id                  UUID PRIMARY KEY,
    descricao_etapa     TEXT NOT NULL CHECK (length(trim(descricao_etapa)) > 0),
    disciplina_projeto  TEXT NOT NULL,
    projetista          TEXT NOT NULL,
    -- Guardado como DATE de verdade: ordenar e comparar prazo no banco exige
    -- data real. O formato DD-MM-YYYY da interface e convertido na API.
    data_conclusao      DATE NOT NULL,
    porcentagem         SMALLINT NOT NULL DEFAULT 0
                          CHECK (porcentagem >= 0 AND porcentagem <= 100),
    ordem               INTEGER NOT NULL DEFAULT 0,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_disciplina  ON tarefas (disciplina_projeto);
CREATE INDEX IF NOT EXISTS idx_tarefas_projetista  ON tarefas (projetista);
CREATE INDEX IF NOT EXISTS idx_tarefas_data        ON tarefas (data_conclusao);
CREATE INDEX IF NOT EXISTS idx_tarefas_ordem       ON tarefas (ordem, data_conclusao);

-- ---------------------------------------------------------------------------
-- 3. STATUS CALCULADO NO BANCO
-- Mesma regra da interface: 0 = Nao Iniciado, 100 = Finalizado, resto = Em Andamento.
-- Fica como coluna gerada para nao haver duas versoes da regra em lugares diferentes.
-- ---------------------------------------------------------------------------
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS status TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN porcentagem = 0   THEN 'Não Iniciado'
      WHEN porcentagem = 100 THEN 'Finalizado'
      ELSE 'Em Andamento'
    END
  ) STORED;

-- ---------------------------------------------------------------------------
-- 4. atualizado_em automatico
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION toca_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tarefas_atualizado ON tarefas;
CREATE TRIGGER trg_tarefas_atualizado
  BEFORE UPDATE ON tarefas
  FOR EACH ROW EXECUTE FUNCTION toca_atualizado_em();

DROP TRIGGER IF EXISTS trg_projeto_atualizado ON projeto;
CREATE TRIGGER trg_projeto_atualizado
  BEFORE UPDATE ON projeto
  FOR EACH ROW EXECUTE FUNCTION toca_atualizado_em();

-- ---------------------------------------------------------------------------
-- 5. CARGA INICIAL — Residencia de Praia (Pedro)
-- ON CONFLICT DO NOTHING: rodar de novo nao sobrescreve o progresso ja lancado.
-- ---------------------------------------------------------------------------
INSERT INTO projeto (
    id, nome_obra, cliente, localizacao, lote_quadra, zona,
    area_construida, area_terreno, tipologia,
    data_inicio, previsao_conclusao, prazo_total, empresa
) VALUES (
    1, 'Residência de Praia', 'Pedro', 'Loteamento Praia Bela, Litoral Sul',
    'Lote 14, Quadra B', 'Zona Residencial Litorânea (ZR-1)',
    '385,00 m²', '450,00 m² (15m x 30m)', 'Residencial Unifamiliar (2 Pavimentos)',
    '12-06-2026', '30-11-2026', '172 dias corridos',
    'ArqVértice • Arquitetura, Estrutura & Engenharia'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO tarefas (id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem, ordem) VALUES
('b4b1a8d0-1c32-4e89-9a21-000000000001', 'Estudo Preliminar',                        'Arquitetura',    'Eduardo Marques', DATE '2026-06-12', 100,  1),
('b4b1a8d0-1c32-4e89-9a21-000000000002', 'Projeto Básico',                           'Arquitetura',    'Eduardo Marques', DATE '2026-06-26', 100,  2),
('b4b1a8d0-1c32-4e89-9a21-000000000003', 'Projeto Executivo',                        'Arquitetura',    'Eduardo Marques', DATE '2026-09-05',  20,  3),
('b4b1a8d0-1c32-4e89-9a21-000000000004', 'Modelagem 3D',                             '3D',             'Eduardo Marques', DATE '2026-08-01',  30,  4),
('b4b1a8d0-1c32-4e89-9a21-000000000005', 'Renderização 3D (Imagens Finais)',         '3D',             'Eduardo Marques', DATE '2026-08-15',   0,  5),
('b4b1a8d0-1c32-4e89-9a21-000000000006', 'Projeto Pré Formas',                       'Estrutura',      'Luan Almeida',    DATE '2026-07-11', 100,  6),
('b4b1a8d0-1c32-4e89-9a21-000000000007', 'Projeto Formas Finais',                    'Estrutura',      'Luan Almeida',    DATE '2026-07-18',  90,  7),
('b4b1a8d0-1c32-4e89-9a21-000000000008', 'Projeto Amaduras',                         'Estrutura',      'Luan Almeida',    DATE '2026-08-01',  30,  8),
('b4b1a8d0-1c32-4e89-9a21-000000000009', 'Projeto Fundação',                         'Estrutura',      'Luan Almeida',    DATE '2026-08-08',  10,  9),
('b4b1a8d0-1c32-4e89-9a21-000000000010', 'Projeto Elétrico',                         'Complementares', 'Eduardo Marques', DATE '2026-08-29',   0, 10),
('b4b1a8d0-1c32-4e89-9a21-000000000011', 'Projeto Hidrossanitário - Abastecimento',  'Complementares', 'Eduardo Marques', DATE '2026-09-12',   0, 11),
('b4b1a8d0-1c32-4e89-9a21-000000000012', 'Projeto Hidrossanitário - Esgotamento',    'Complementares', 'Eduardo Marques', DATE '2026-09-19',   0, 12),
('b4b1a8d0-1c32-4e89-9a21-000000000013', 'Projeto Hidrossanitário - Drenagem',       'Complementares', 'Eduardo Marques', DATE '2026-09-19',   0, 13),
('b4b1a8d0-1c32-4e89-9a21-000000000014', 'Execução de Obras',                        'Obras',          'Erick Santiago',  DATE '2026-10-15',   0, 14)
ON CONFLICT (id) DO NOTHING;
