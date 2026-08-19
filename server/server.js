/**
 * ============================================================================
 * BACKEND REST API - CRONOGRAMA DE PROJETOS MULTIDISCIPLINARES
 * Arquivo: server/server.js
 * Framework: Express.js + SQLite / In-Memory / JSON Datastore
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'tarefas_database.json');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// DADOS DE SEED PADRÃO
const SEED_DATA = [
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000001', descricao_etapa: 'Estudo Preliminar', disciplina_projeto: 'Arquitetura', projetista: 'Eduardo', data_conclusao: '12-06-2026', porcentagem: 100 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000002', descricao_etapa: 'Projeto Básico', disciplina_projeto: 'Arquitetura', projetista: 'Eduardo', data_conclusao: '26-06-2026', porcentagem: 100 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000003', descricao_etapa: 'Projeto Executivo', disciplina_projeto: 'Arquitetura', projetista: 'Eduardo', data_conclusao: '05-09-2026', porcentagem: 20 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000004', descricao_etapa: 'Modelagem 3D', disciplina_projeto: 'Arquitetura', projetista: 'Eduardo', data_conclusao: '01-08-2026', porcentagem: 30 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000005', descricao_etapa: 'Renderização 3D (Imagens Finais)', disciplina_projeto: 'Arquitetura', projetista: 'Eduardo', data_conclusao: '15-08-2026', porcentagem: 0 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000006', descricao_etapa: 'Projeto Pré Formas', disciplina_projeto: 'Estrutura', projetista: 'Luan', data_conclusao: '11-07-2026', porcentagem: 100 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000007', descricao_etapa: 'Projeto Formas Finais', disciplina_projeto: 'Estrutura', projetista: 'Luan', data_conclusao: '18-07-2026', porcentagem: 90 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000008', descricao_etapa: 'Projeto Amaduras', disciplina_projeto: 'Estrutura', projetista: 'Luan', data_conclusao: '01-08-2026', porcentagem: 30 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000009', descricao_etapa: 'Projeto Fundação', disciplina_projeto: 'Estrutura', projetista: 'Luan', data_conclusao: '08-08-2026', porcentagem: 10 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000010', descricao_etapa: 'Projeto Elétrico', disciplina_projeto: 'Complementares', projetista: 'Eduardo', data_conclusao: '29-08-2026', porcentagem: 0 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000011', descricao_etapa: 'Projeto Hidrossanitário - Abastecimento', disciplina_projeto: 'Complementares', projetista: 'Eduardo', data_conclusao: '12-09-2026', porcentagem: 0 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000012', descricao_etapa: 'Projeto Hidrossanitário - Esgotamento', disciplina_projeto: 'Complementares', projetista: 'Eduardo', data_conclusao: '19-09-2026', porcentagem: 0 },
  { id: 'b4b1a8d0-1c32-4e89-9a21-000000000013', descricao_etapa: 'Projeto Hidrossanitário - Drenagem', disciplina_projeto: 'Complementares', projetista: 'Eduardo', data_conclusao: '19-09-2026', porcentagem: 0 }
];

// Funções de Persistência em Arquivo
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(SEED_DATA, null, 2));
      return JSON.parse(JSON.stringify(SEED_DATA));
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erro ao ler DB:', err);
    return JSON.parse(JSON.stringify(SEED_DATA));
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro ao gravar DB:', err);
  }
}

// Helpers de Campos Virtuais
function enrichTask(task) {
  const p = Number(task.porcentagem) || 0;
  let status = 'Não Iniciado';
  if (p >= 100) status = 'Finalizado';
  else if (p > 0) status = 'Em Andamento';

  return {
    ...task,
    status,
    porcentagem: p
  };
}

// ============================================================================
// ROTAS REST DA API
// ============================================================================

// 1. Listar todas as tarefas com filtros opcionais
app.get('/api/tarefas', (req, res) => {
  let tasks = readDB().map(enrichTask);
  const { disciplina, projetista, status } = req.query;

  if (disciplina && disciplina !== 'all') {
    tasks = tasks.filter(t => t.disciplina_projeto === disciplina);
  }
  if (projetista && projetista !== 'all') {
    tasks = tasks.filter(t => t.projetista === projetista);
  }
  if (status && status !== 'all') {
    tasks = tasks.filter(t => t.status === status);
  }

  res.json({
    total: tasks.length,
    data: tasks
  });
});

// 2. Buscar tarefa por ID
app.get('/api/tarefas/:id', (req, res) => {
  const tasks = readDB();
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }
  res.json(enrichTask(task));
});

// 3. Criar nova tarefa
app.post('/api/tarefas', (req, res) => {
  const { descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem } = req.body;

  if (!descricao_etapa || !disciplina_projeto || !projetista || !data_conclusao) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
  }

  const tasks = readDB();
  const newTask = {
    id: crypto.randomUUID(),
    descricao_etapa,
    disciplina_projeto,
    projetista,
    data_conclusao,
    porcentagem: parseInt(porcentagem, 10) || 0,
    criado_em: new Date().toISOString()
  };

  tasks.push(newTask);
  writeDB(tasks);
  res.status(201).json(enrichTask(newTask));
});

// 4. Atualizar tarefa existente (parcial ou completa)
app.put('/api/tarefas/:id', (req, res) => {
  const tasks = readDB();
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  const updated = {
    ...tasks[index],
    ...req.body,
    id: req.params.id, // Preservar ID
    atualizado_em: new Date().toISOString()
  };

  tasks[index] = updated;
  writeDB(tasks);
  res.json(enrichTask(updated));
});

// 5. Excluir tarefa
app.delete('/api/tarefas/:id', (req, res) => {
  let tasks = readDB();
  const initialLen = tasks.length;
  tasks = tasks.filter(t => t.id !== req.params.id);

  if (tasks.length === initialLen) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }

  writeDB(tasks);
  res.json({ message: 'Tarefa excluída com sucesso' });
});

// 6. Resetar dados para o Seed original
app.post('/api/seed', (req, res) => {
  writeDB(SEED_DATA);
  res.json({ message: 'Banco de dados restaurado para os 13 registros originais do PDF!', data: SEED_DATA.map(enrichTask) });
});

// 7. KPIs Consolidados do Projeto
app.get('/api/kpis', (req, res) => {
  const tasks = readDB();
  const totalTasks = tasks.length;
  const sumPercent = tasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0);
  const avgTotal = totalTasks > 0 ? Math.round(sumPercent / totalTasks) : 0;

  const getDiscAvg = (disc) => {
    const dTasks = tasks.filter(t => t.disciplina_projeto === disc);
    const sum = dTasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0);
    return {
      total: dTasks.length,
      progresso_medio: dTasks.length > 0 ? Math.round(sum / dTasks.length) : 0
    };
  };

  res.json({
    total_tarefas: totalTasks,
    progresso_geral_porcentagem: avgTotal,
    disciplinas: {
      arquitetura: getDiscAvg('Arquitetura'),
      estrutura: getDiscAvg('Estrutura'),
      complementares: getDiscAvg('Complementares')
    }
  });
});

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`[API Cronograma] Servidor rodando na porta http://localhost:${PORT}`);
});
