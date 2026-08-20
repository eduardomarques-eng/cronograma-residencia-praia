-- ============================================================================
-- MODELAGEM DE DADOS: SISTEMA DE CRONOGRAMA DE PROJETOS MULTIDISCIPLINARES
-- Arquivo: schema.sql (Compatível com SQLite, PostgreSQL e MySQL)
-- ============================================================================

-- 1. CRIAÇÃO DA TABELA PRINCIPAL 'TarefasProjeto'
CREATE TABLE IF NOT EXISTS TarefasProjeto (
    id VARCHAR(36) PRIMARY KEY,
    descricao_etapa VARCHAR(255) NOT NULL,
    disciplina_projeto VARCHAR(50) NOT NULL CHECK (disciplina_projeto IN ('Arquitetura', '3D', 'Estrutura', 'Complementares', 'Obras')),
    projetista VARCHAR(100) NOT NULL CHECK (projetista IN ('Eduardo Marques', 'Luan Almeida', 'Erick Santiago')),
    data_conclusao VARCHAR(10) NOT NULL, -- Formato DD-MM-YYYY conforme especificação
    porcentagem INT NOT NULL DEFAULT 0 CHECK (porcentagem >= 0 AND porcentagem <= 100),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES DE DESEMPENHO PARA CONSULTAS E FILTRAGEM RÁPIDA
CREATE INDEX IF NOT EXISTS idx_tarefas_disciplina ON TarefasProjeto(disciplina_projeto);
CREATE INDEX IF NOT EXISTS idx_tarefas_projetista ON TarefasProjeto(projetista);
CREATE INDEX IF NOT EXISTS idx_tarefas_porcentagem ON TarefasProjeto(porcentagem);

-- 3. VIEW COM CAMPOS VIRTUAIS/CALCULADOS (Status, Categoria de Progresso e Alerta Crítico)
-- Status:
--   0% -> 'Não Iniciado'
--   1% a 99% -> 'Em Andamento'
--   100% -> 'Finalizado'
CREATE VIEW IF NOT EXISTS v_TarefasProjetoCalculadas AS
SELECT 
    id,
    descricao_etapa,
    disciplina_projeto,
    projetista,
    data_conclusao,
    porcentagem,
    CASE 
        WHEN porcentagem = 0 THEN 'Não Iniciado'
        WHEN porcentagem > 0 AND porcentagem < 100 THEN 'Em Andamento'
        WHEN porcentagem >= 100 THEN 'Finalizado'
    END AS status,
    CASE 
        WHEN porcentagem >= 99 THEN 'Finalizado (>=99%)'
        WHEN porcentagem >= 40 THEN 'Em Desenvolvimento (40-99%)'
        ELSE 'Inicial (<40%)'
    END AS categoria_progresso
FROM TarefasProjeto;

-- 4. DADOS DE SEED (Carga Inicial ArqVértice)
INSERT INTO TarefasProjeto (id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem) VALUES
('b4b1a8d0-1c32-4e89-9a21-000000000001', 'Estudo Preliminar', 'Arquitetura', 'Eduardo Marques', '12-06-2026', 100),
('b4b1a8d0-1c32-4e89-9a21-000000000002', 'Projeto Básico', 'Arquitetura', 'Eduardo Marques', '26-06-2026', 100),
('b4b1a8d0-1c32-4e89-9a21-000000000003', 'Projeto Executivo', 'Arquitetura', 'Eduardo Marques', '05-09-2026', 20),
('b4b1a8d0-1c32-4e89-9a21-000000000004', 'Modelagem 3D', '3D', 'Eduardo Marques', '01-08-2026', 30),
('b4b1a8d0-1c32-4e89-9a21-000000000005', 'Renderização 3D (Imagens Finais)', '3D', 'Eduardo Marques', '15-08-2026', 0),
('b4b1a8d0-1c32-4e89-9a21-000000000006', 'Projeto Pré Formas', 'Estrutura', 'Luan Almeida', '11-07-2026', 100),
('b4b1a8d0-1c32-4e89-9a21-000000000007', 'Projeto Formas Finais', 'Estrutura', 'Luan Almeida', '18-07-2026', 90),
('b4b1a8d0-1c32-4e89-9a21-000000000008', 'Projeto Amaduras', 'Estrutura', 'Luan Almeida', '01-08-2026', 30),
('b4b1a8d0-1c32-4e89-9a21-000000000009', 'Projeto Fundação', 'Estrutura', 'Luan Almeida', '08-08-2026', 10),
('b4b1a8d0-1c32-4e89-9a21-000000000010', 'Projeto Elétrico', 'Complementares', 'Eduardo Marques', '29-08-2026', 0),
('b4b1a8d0-1c32-4e89-9a21-000000000011', 'Projeto Hidrossanitário - Abastecimento', 'Complementares', 'Eduardo Marques', '12-09-2026', 0),
('b4b1a8d0-1c32-4e89-9a21-000000000012', 'Projeto Hidrossanitário - Esgotamento', 'Complementares', 'Eduardo Marques', '19-09-2026', 0),
('b4b1a8d0-1c32-4e89-9a21-000000000013', 'Projeto Hidrossanitário - Drenagem', 'Complementares', 'Eduardo Marques', '19-09-2026', 0),
('b4b1a8d0-1c32-4e89-9a21-000000000014', 'Execução de Obras', 'Obras', 'Erick Santiago', '15-10-2026', 0)
ON CONFLICT (id) DO NOTHING;
