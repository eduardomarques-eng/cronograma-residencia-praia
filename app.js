/**
 * ============================================================================
 * CRONOGRAMA DE PROJETOS - RESIDÊNCIA PRAIA (PEDRO)
 * Sistema de Gerenciamento e Controle de Cronograma Multidisciplinar
 * ============================================================================
 */

// Chave do LocalStorage
const STORAGE_KEY = 'cronograma_residencia_praia_tasks_v1';
const THEME_KEY = 'cronograma_residencia_praia_theme_v1';
const PROJECT_INFO_KEY = 'cronograma_residencia_praia_project_info_v1';

/**
 * DADOS CADASTRAIS PADRÃO DA OBRA / PROJETO
 */
const DEFAULT_PROJECT_INFO = {
  nomeObra: 'Residência de Praia',
  cliente: 'Pedro',
  localizacao: 'Loteamento Praia Bela, Litoral Sul',
  loteQuadra: 'Lote 14, Quadra B',
  zona: 'Zona Residencial Litorânea (ZR-1)',
  areaConstruida: '385,00 m²',
  areaTerreno: '450,00 m² (15m x 30m)',
  tipologia: 'Residencial Unifamiliar (2 Pavimentos)',
  dataInicio: '12-06-2026',
  previsaoConclusao: '30-11-2026',
  prazoTotal: '172 dias corridos',
  empresa: 'ArqVértice • Arquitetura, Estrutura & Engenharia'
};

/**
 * 1. DADOS DE SEED (Carga Inicial extraída fielmente do PDF)
 */
const SEED_TASKS = [
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000001',
    descricao_etapa: 'Estudo Preliminar',
    disciplina_projeto: 'Arquitetura',
    projetista: 'Eduardo Marques',
    data_conclusao: '12-06-2026',
    porcentagem: 100
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000002',
    descricao_etapa: 'Projeto Básico',
    disciplina_projeto: 'Arquitetura',
    projetista: 'Eduardo Marques',
    data_conclusao: '26-06-2026',
    porcentagem: 100
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000003',
    descricao_etapa: 'Projeto Executivo',
    disciplina_projeto: 'Arquitetura',
    projetista: 'Eduardo Marques',
    data_conclusao: '05-09-2026',
    porcentagem: 20
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000004',
    descricao_etapa: 'Modelagem 3D',
    disciplina_projeto: 'Arquitetura',
    projetista: 'Eduardo Marques',
    data_conclusao: '01-08-2026',
    porcentagem: 30
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000005',
    descricao_etapa: 'Renderização 3D (Imagens Finais)',
    disciplina_projeto: 'Arquitetura',
    projetista: 'Eduardo Marques',
    data_conclusao: '15-08-2026',
    porcentagem: 0
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000006',
    descricao_etapa: 'Projeto Pré Formas',
    disciplina_projeto: 'Estrutura',
    projetista: 'Luan Almeida',
    data_conclusao: '11-07-2026',
    porcentagem: 100
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000007',
    descricao_etapa: 'Projeto Formas Finais',
    disciplina_projeto: 'Estrutura',
    projetista: 'Luan Almeida',
    data_conclusao: '18-07-2026',
    porcentagem: 90
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000008',
    descricao_etapa: 'Projeto Amaduras',
    disciplina_projeto: 'Estrutura',
    projetista: 'Luan Almeida',
    data_conclusao: '01-08-2026',
    porcentagem: 30
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000009',
    descricao_etapa: 'Projeto Fundação',
    disciplina_projeto: 'Estrutura',
    projetista: 'Luan Almeida',
    data_conclusao: '08-08-2026',
    porcentagem: 10
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000010',
    descricao_etapa: 'Projeto Elétrico',
    disciplina_projeto: 'Complementares',
    projetista: 'Eduardo Marques',
    data_conclusao: '29-08-2026',
    porcentagem: 0
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000011',
    descricao_etapa: 'Projeto Hidrossanitário - Abastecimento',
    disciplina_projeto: 'Complementares',
    projetista: 'Eduardo Marques',
    data_conclusao: '12-09-2026',
    porcentagem: 0
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000012',
    descricao_etapa: 'Projeto Hidrossanitário - Esgotamento',
    disciplina_projeto: 'Complementares',
    projetista: 'Eduardo Marques',
    data_conclusao: '19-09-2026',
    porcentagem: 0
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000013',
    descricao_etapa: 'Projeto Hidrossanitário - Drenagem',
    disciplina_projeto: 'Complementares',
    projetista: 'Eduardo Marques',
    data_conclusao: '19-09-2026',
    porcentagem: 0
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000014',
    descricao_etapa: 'Execução de Obras',
    disciplina_projeto: 'Obras',
    projetista: 'Erick Santiago',
    data_conclusao: '15-10-2026',
    porcentagem: 0
  }
];

/**
 * 2. ESTADO GLOBAL DA APLICAÇÃO
 */
const AppState = {
  tasks: [],
  projectInfo: { ...DEFAULT_PROJECT_INFO },
  filters: {
    daysLimit: 30, // Padrão conforme documento: 30 dias
    disciplina: 'all',
    projetista: 'all',
    status: 'all',
    search: ''
  },
  sort: {
    column: 'data_conclusao',
    direction: 'asc'
  },
  currentView: 'kanban', // 'kanban' ou 'datagrid'
  draggedTaskId: null
};

/**
 * 3. HELPERS DE CÁLCULO E FORMATAÇÃO (MODELAGEM DE DADOS)
 */

// Gerador de UUID v4
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Campo Virtual / Calculado: Status
 * - Porcentagem == 0 -> "Não Iniciado"
 * - Porcentagem > 0 e < 100 -> "Em Andamento"
 * - Porcentagem == 100 -> "Finalizado"
 */
function calculateStatus(porcentagem) {
  const p = Number(porcentagem) || 0;
  if (p === 0) return 'Não Iniciado';
  if (p >= 100) return 'Finalizado';
  return 'Em Andamento';
}

/**
 * Converte data DD-MM-YYYY para objeto Date do JavaScript
 */
function parseDateBR(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

/**
 * Formata Date para DD-MM-YYYY
 */
function formatDateBR(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Calcula a diferença em dias entre a data de conclusão da tarefa e a data de referência.
 * Como o projeto tem marco em 2026, usamos a data atual do sistema (2026-08-19) como referência.
 */
function getDaysRemaining(dataConclusaoStr) {
  const targetDate = parseDateBR(dataConclusaoStr);
  const now = new Date(); // 2026-08-19 no contexto do sistema
  
  // Normalizar para meia-noite
  targetDate.setHours(0, 0, 0, 0);
  const refDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = targetDate.getTime() - refDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determina a cor visual do progresso baseado na legenda oficial do PDF:
 * - >= 99% : Amarelo Ouro / Dourado (#eab308)
 * - >= 40% e < 99% : Verde (#84cc16)
 * - >= 0% e < 40% : Azul Ciano (#38bdf8)
 */
function getProgressColor(porcentagem) {
  const p = Number(porcentagem) || 0;
  if (p >= 99) return 'var(--pdf-gold)';
  if (p >= 40) return 'var(--pdf-green)';
  return 'var(--pdf-blue)';
}

/**
 * 4. PERSISTÊNCIA (LocalStorage)
 */
function loadProjectInfo() {
  try {
    const raw = localStorage.getItem(PROJECT_INFO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        AppState.projectInfo = { ...DEFAULT_PROJECT_INFO, ...parsed };
        return;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar dados do projeto:', e);
  }
  AppState.projectInfo = { ...DEFAULT_PROJECT_INFO };
  saveProjectInfo();
}

function saveProjectInfo() {
  try {
    localStorage.setItem(PROJECT_INFO_KEY, JSON.stringify(AppState.projectInfo));
  } catch (e) {
    console.error('Erro ao salvar dados do projeto:', e);
  }
}

function renderProjectInfo() {
  const p = AppState.projectInfo || {};
  
  const elObraName = document.getElementById('header-obra-name');
  if (elObraName) elObraName.textContent = p.nomeObra || 'Nova Obra';
  
  const elCliente = document.getElementById('header-cliente-val');
  if (elCliente) elCliente.textContent = p.cliente || 'Não informado';

  const elLocal = document.getElementById('header-local-val');
  if (elLocal) elLocal.textContent = p.localizacao || 'Não informado';

  const elLoteQuadra = document.getElementById('header-lotequadra-val');
  if (elLoteQuadra) elLoteQuadra.textContent = p.loteQuadra || 'Não informado';

  const elZona = document.getElementById('header-zona-val');
  if (elZona) elZona.textContent = p.zona || 'Não informado';

  const elTipologia = document.getElementById('header-tipologia-val');
  if (elTipologia) elTipologia.textContent = p.tipologia || 'Residencial';

  const elTipologiaBadge = document.getElementById('header-tipologia-badge');
  if (elTipologiaBadge) elTipologiaBadge.textContent = (p.tipologia || 'Edificação Residencial').toUpperCase();

  const elAreaConst = document.getElementById('header-areaconst-val');
  if (elAreaConst) elAreaConst.textContent = p.areaConstruida || '-';

  const elAreaTerreno = document.getElementById('header-areaterreno-val');
  if (elAreaTerreno) elAreaTerreno.textContent = p.areaTerreno || '-';

  const elInicio = document.getElementById('header-inicio-val');
  if (elInicio) elInicio.textContent = p.dataInicio || 'DD-MM-AAAA';

  const elFim = document.getElementById('header-fim-val');
  if (elFim) elFim.textContent = p.previsaoConclusao || 'DD-MM-AAAA';
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Normalização automática dos nomes de colaboradores (Luan Almeida, Eduardo Marques, Erick Santiago)
        parsed = parsed.map(t => {
          let proj = t.projetista;
          if (proj === 'Eduardo') proj = 'Eduardo Marques';
          if ((proj === 'Luan' || proj === 'Luan Cavalcante') && t.disciplina_projeto !== 'Obras') proj = 'Luan Almeida';
          if (t.disciplina_projeto === 'Obras') proj = 'Erick Santiago';
          return { ...t, projetista: proj };
        });

        // Garantir que a etapa de Obras esteja presente
        if (!parsed.some(t => t.disciplina_projeto === 'Obras')) {
          parsed.push({
            id: 'b4b1a8d0-1c32-4e89-9a21-000000000014',
            descricao_etapa: 'Execução de Obras',
            disciplina_projeto: 'Obras',
            projetista: 'Erick Santiago',
            data_conclusao: '15-10-2026',
            porcentagem: 0
          });
        }

        AppState.tasks = parsed;
        saveTasks();
        return;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar dados do LocalStorage:', e);
  }
  // Se não houver dados, carrega o SEED
  AppState.tasks = JSON.parse(JSON.stringify(SEED_TASKS));
  saveTasks();
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.tasks));
  } catch (e) {
    console.error('Erro ao salvar tarefas:', e);
  }
}

/**
 * 5. CÁLCULO E ATUALIZAÇÃO DOS KPIS
 */
function updateKPIs() {
  const tasks = AppState.tasks;
  const totalTasks = tasks.length;

  if (totalTasks === 0) return;

  // 1. Progresso Geral
  const sumPercent = tasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0);
  const totalAvg = Math.round(sumPercent / totalTasks);
  const completedTasks = tasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;

  document.getElementById('kpi-total-percent').textContent = `${totalAvg}%`;
  document.getElementById('kpi-tasks-count').textContent = `${completedTasks} / ${totalTasks} concluídas`;
  const mainBar = document.getElementById('kpi-main-progress-bar');
  if (mainBar) {
    mainBar.style.width = `${totalAvg}%`;
    mainBar.style.backgroundColor = getProgressColor(totalAvg);
  }

  // 2. Progresso por Disciplina
  const calcDiscipline = (discName, elemPrefix) => {
    const discTasks = tasks.filter(t => t.disciplina_projeto === discName);
    const count = discTasks.length;
    const avg = count > 0 
      ? Math.round(discTasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0) / count)
      : 0;

    const percentElem = document.getElementById(`kpi-${elemPrefix}-percent`);
    const countElem = document.getElementById(`kpi-${elemPrefix}-count`);
    const barElem = document.getElementById(`kpi-${elemPrefix}-progress-bar`);

    if (percentElem) percentElem.textContent = `${avg}%`;
    if (countElem) countElem.textContent = `${count} tarefas`;
    if (barElem) barElem.style.width = `${avg}%`;
  };

  calcDiscipline('Arquitetura', 'arq');
  calcDiscipline('Estrutura', 'est');
  calcDiscipline('Complementares', 'comp');
  calcDiscipline('Obras', 'obr');

  // 3. Prazos Críticos (≤ 7 dias para vencer e status != 'Finalizado')
  const criticalTasks = tasks.filter(t => {
    const status = calculateStatus(t.porcentagem);
    if (status === 'Finalizado') return false;
    const days = getDaysRemaining(t.data_conclusao);
    return days <= 7; // <= 7 dias restantes ou já vencido
  });

  const critElem = document.getElementById('kpi-critical-count');
  if (critElem) {
    critElem.textContent = criticalTasks.length;
  }
}

/**
 * 6. FILTRAGEM DINÂMICA
 */
function getFilteredTasks() {
  return AppState.tasks.filter(task => {
    const status = calculateStatus(task.porcentagem);
    const days = getDaysRemaining(task.data_conclusao);

    // Filtro de Vencimento dentro de X dias (ou all)
    if (AppState.filters.daysLimit !== 'all') {
      const maxDays = Number(AppState.filters.daysLimit);
      // Inclui tarefas que vencem em até maxDays ou que já estão em curso com prazo próximo
      if (days > maxDays) return false;
    }

    // Filtro de Disciplina
    if (AppState.filters.disciplina !== 'all') {
      if (task.disciplina_projeto !== AppState.filters.disciplina) return false;
    }

    // Filtro de Projetista
    if (AppState.filters.projetista !== 'all') {
      if (task.projetista !== AppState.filters.projetista) return false;
    }

    // Filtro de Status
    if (AppState.filters.status !== 'all') {
      if (status !== AppState.filters.status) return false;
    }

    // Filtro de Busca Textual
    if (AppState.filters.search.trim() !== '') {
      const q = AppState.filters.search.toLowerCase().trim();
      const etapa = (task.descricao_etapa || '').toLowerCase();
      const disc = (task.disciplina_projeto || '').toLowerCase();
      const proj = (task.projetista || '').toLowerCase();
      if (!etapa.includes(q) && !disc.includes(q) && !proj.includes(q)) return false;
    }

    return true;
  });
}

/**
 * 7. RENDERIZAÇÃO DA VISÃO KANBAN
 */
function renderKanban(filteredTasks) {
  const colNaoIniciado = document.getElementById('list-nao-iniciado');
  const colEmAndamento = document.getElementById('list-em-andamento');
  const colFinalizado = document.getElementById('list-finalizado');

  if (!colNaoIniciado || !colEmAndamento || !colFinalizado) return;

  colNaoIniciado.innerHTML = '';
  colEmAndamento.innerHTML = '';
  colFinalizado.innerHTML = '';

  let countNaoIniciado = 0;
  let countEmAndamento = 0;
  let countFinalizado = 0;

  filteredTasks.forEach(task => {
    const status = calculateStatus(task.porcentagem);
    const days = getDaysRemaining(task.data_conclusao);
    const isCritical = status !== 'Finalizado' && days <= 7;
    const progressColor = getProgressColor(task.porcentagem);

    // Mapeamento de classe da disciplina
    let discBadgeClass = 'badge-arq';
    if (task.disciplina_projeto === 'Estrutura') discBadgeClass = 'badge-est';
    if (task.disciplina_projeto === 'Complementares') discBadgeClass = 'badge-comp';
    if (task.disciplina_projeto === 'Obras') discBadgeClass = 'badge-obras';

    // Criação do elemento Card
    const card = document.createElement('div');
    card.className = `kanban-card ${isCritical ? 'card-critical' : ''}`;
    card.draggable = true;
    card.dataset.taskId = task.id;

    // Drag events
    card.addEventListener('dragstart', (e) => {
      AppState.draggedTaskId = task.id;
      card.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      AppState.draggedTaskId = null;
    });

    // Template HTML do Card
    card.innerHTML = `
      <div class="card-top-row">
        <span class="badge-disciplina ${discBadgeClass}">${escapeHTML(task.disciplina_projeto)}</span>
        ${isCritical ? `
          <span class="card-alert-badge" title="Prazo crítico: ${days < 0 ? 'Vencida há ' + Math.abs(days) + ' dias' : 'Vence em ' + days + ' dias'}">
            <i data-lucide="alert-circle"></i>
            ${days < 0 ? 'Atrasada' : days + 'd'}
          </span>
        ` : ''}
      </div>

      <div class="card-title">${escapeHTML(task.descricao_etapa)}</div>

      <div class="card-meta-row">
        <div class="card-author" title="Responsável: ${escapeHTML(task.projetista)}">
          <div class="author-avatar">${escapeHTML(task.projetista.charAt(0))}</div>
          <span>${escapeHTML(task.projetista)}</span>
        </div>
        <div class="card-date" title="Data Limite de Entrega">
          <i data-lucide="calendar"></i>
          <span>${escapeHTML(task.data_conclusao)}</span>
        </div>
      </div>

      <div class="card-progress-wrapper">
        <div class="card-progress-header">
          <span>Progresso</span>
          <span style="color: ${progressColor}">${task.porcentagem}%</span>
        </div>
        <div class="custom-progress-track">
          <div class="custom-progress-bar" style="width: ${task.porcentagem}%; background-color: ${progressColor};"></div>
        </div>
      </div>

      <div class="card-footer-actions">
        <button class="btn-card-action" onclick="quickEditPercent('${task.id}')" title="Ajustar Porcentagem">
          <i data-lucide="percent"></i>
        </button>
        <button class="btn-card-action" onclick="openEditModal('${task.id}')" title="Editar Tarefa">
          <i data-lucide="edit-3"></i>
        </button>
        <button class="btn-card-action danger" onclick="deleteTask('${task.id}')" title="Excluir Tarefa">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    // Distribuição automática por Status
    if (status === 'Não Iniciado') {
      colNaoIniciado.appendChild(card);
      countNaoIniciado++;
    } else if (status === 'Em Andamento') {
      colEmAndamento.appendChild(card);
      countEmAndamento++;
    } else if (status === 'Finalizado') {
      colFinalizado.appendChild(card);
      countFinalizado++;
    }
  });

  // Atualizar contadores das colunas
  document.getElementById('count-nao-iniciado').textContent = countNaoIniciado;
  document.getElementById('count-em-andamento').textContent = countEmAndamento;
  document.getElementById('count-finalizado').textContent = countFinalizado;

  // Placeholder vazio para colunas sem cards
  [colNaoIniciado, colEmAndamento, colFinalizado].forEach(col => {
    if (col.children.length === 0) {
      col.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.8125rem;">Nenhuma tarefa nesta etapa</div>`;
    }
  });
}

/**
 * 8. RENDERIZAÇÃO DA VISÃO TABELA DE CONTROLE (DATAGRID COM EDIÇÃO IN-LINE)
 */
function renderDataGrid(filteredTasks) {
  const tbody = document.getElementById('datagrid-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (filteredTasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">
          Nenhuma tarefa corresponde aos filtros selecionados.
        </td>
      </tr>
    `;
    return;
  }

  filteredTasks.forEach(task => {
    const status = calculateStatus(task.porcentagem);
    const days = getDaysRemaining(task.data_conclusao);
    const isCritical = status !== 'Finalizado' && days <= 7;
    const progressColor = getProgressColor(task.porcentagem);

    // Mapeamento de badge de status
    let statusClass = 'status-nao-iniciado';
    if (status === 'Em Andamento') statusClass = 'status-em-andamento';
    if (status === 'Finalizado') statusClass = 'status-finalizado';

    // Mapeamento de classe da disciplina
    let discBadgeClass = 'badge-arq';
    if (task.disciplina_projeto === 'Estrutura') discBadgeClass = 'badge-est';
    if (task.disciplina_projeto === 'Complementares') discBadgeClass = 'badge-comp';
    if (task.disciplina_projeto === 'Obras') discBadgeClass = 'badge-obras';

    const tr = document.createElement('tr');
    tr.className = isCritical ? 'row-critical' : '';

    tr.innerHTML = `
      <!-- 1. Descrição / Etapa (Editável via clique) -->
      <td>
        <div class="cell-etapa" title="Clique para editar">${escapeHTML(task.descricao_etapa)}</div>
      </td>

      <!-- 2. Projeto / Disciplina -->
      <td>
        <span class="badge-disciplina ${discBadgeClass}">${escapeHTML(task.disciplina_projeto)}</span>
      </td>

      <!-- 3. Projetista -->
      <td>
        <div class="card-author">
          <div class="author-avatar">${escapeHTML(task.projetista.charAt(0))}</div>
          <span style="font-weight: 600;">${escapeHTML(task.projetista)}</span>
        </div>
      </td>

      <!-- 4. Data de Conclusão (Editável In-line) -->
      <td>
        <div class="cell-date-badge">
          <input type="text" 
                 class="date-edit-input" 
                 value="${escapeHTML(task.data_conclusao)}" 
                 data-task-id="${task.id}" 
                 placeholder="DD-MM-YYYY"
                 title="Edite a data e pressione Enter">
          ${isCritical ? `
            <i data-lucide="alert-triangle" class="text-danger" style="width: 14px; height: 14px;" title="Prazo Crítico: ${days <= 0 ? 'Atrasada' : days + ' dias'}"></i>
          ` : ''}
        </div>
      </td>

      <!-- 5. Progresso Visual (Barra no estilo do PDF) -->
      <td>
        <div class="table-progress-bar">
          <div class="table-track">
            <div class="table-fill" style="width: ${task.porcentagem}%; background-color: ${progressColor};"></div>
          </div>
        </div>
      </td>

      <!-- 6. Percentagem (Editável In-line com atualização imediata) -->
      <td>
        <div class="inline-percent-box">
          <input type="number" 
                 min="0" 
                 max="100" 
                 class="percent-input-inline" 
                 value="${task.porcentagem}" 
                 data-task-id="${task.id}"
                 title="Altere o valor para atualizar o status automaticamente">
          <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">%</span>
        </div>
      </td>

      <!-- 7. Status Calculado -->
      <td>
        <span class="status-pill ${statusClass}">
          ${escapeHTML(status)}
        </span>
      </td>

      <!-- 8. Ações -->
      <td>
        <div class="actions-cell">
          <button class="btn-card-action" onclick="openEditModal('${task.id}')" title="Editar Tarefa Completa">
            <i data-lucide="edit"></i>
          </button>
          <button class="btn-card-action danger" onclick="deleteTask('${task.id}')" title="Excluir Tarefa">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Anexar event listeners para os inputs in-line
  attachInlineListeners();
}

/**
 * Listeners para edição in-line rápida na tabela
 */
function attachInlineListeners() {
  // 1. Edição in-line de Porcentagem
  document.querySelectorAll('.percent-input-inline').forEach(input => {
    input.addEventListener('change', (e) => {
      const taskId = e.target.dataset.taskId;
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      if (val < 0) val = 0;
      if (val > 100) val = 100;
      e.target.value = val;

      updateTaskProperty(taskId, { porcentagem: val });
      showToast(`Porcentagem atualizada para ${val}%!`);
    });
  });

  // 2. Edição in-line de Data
  document.querySelectorAll('.date-edit-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const taskId = e.target.dataset.taskId;
      const val = e.target.value.trim();
      
      // Validação simples formato DD-MM-YYYY
      const regex = /^\d{2}-\d{2}-\d{4}$/;
      if (!regex.test(val)) {
        alert('Por favor, utilize o formato DD-MM-YYYY (Ex: 15-08-2026)');
        renderApp();
        return;
      }

      updateTaskProperty(taskId, { data_conclusao: val });
      showToast(`Data atualizada para ${val}!`);
    });
  });
}

/**
 * 9. RENDERIZAÇÃO GERAL E RE-SINCRONIZAÇÃO
 */
function renderApp() {
  const filtered = getFilteredTasks();
  
  // Atualiza contagem no rodapé dos filtros
  const countLabel = document.getElementById('results-count-label');
  if (countLabel) {
    countLabel.textContent = `Exibindo ${filtered.length} de ${AppState.tasks.length} tarefas`;
  }

  // Atualiza KPIs
  updateKPIs();

  // Renderiza a visão ativa
  if (AppState.currentView === 'kanban') {
    renderKanban(filtered);
  } else {
    renderDataGrid(filtered);
  }

  // Reinicializa ícones Lucide
  if (window.lucide) {
    lucide.createIcons();
  }
}

/**
 * 10. OPERAÇÕES DE CRUD DE TAREFAS
 */
function updateTaskProperty(taskId, updates) {
  const taskIndex = AppState.tasks.findIndex(t => t.id === taskId);
  if (taskIndex !== -1) {
    AppState.tasks[taskIndex] = {
      ...AppState.tasks[taskIndex],
      ...updates
    };
    saveTasks();
    renderApp();
  }
}

function saveTaskFromModal(e) {
  e.preventDefault();

  const id = document.getElementById('task-id').value;
  const descricao = document.getElementById('form-descricao').value.trim();
  const disciplina = document.getElementById('form-disciplina').value;
  const projetista = document.getElementById('form-projetista').value;
  const data = document.getElementById('form-data').value.trim();
  const porcentagem = parseInt(document.getElementById('form-porcentagem').value, 10) || 0;

  if (!descricao || !data) {
    alert('Preencha todos os campos obrigatórios.');
    return;
  }

  // Validação de formato da data DD-MM-YYYY
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(data)) {
    alert('Formato de data inválido. Use DD-MM-YYYY (Ex: 15-08-2026).');
    return;
  }

  if (id) {
    // Edição
    const index = AppState.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      AppState.tasks[index] = {
        ...AppState.tasks[index],
        descricao_etapa: descricao,
        disciplina_projeto: disciplina,
        projetista: projetista,
        data_conclusao: data,
        porcentagem: porcentagem
      };
      showToast('Tarefa atualizada com sucesso!');
    }
  } else {
    // Nova Tarefa
    const newTask = {
      id: generateUUID(),
      descricao_etapa: descricao,
      disciplina_projeto: disciplina,
      projetista: projetista,
      data_conclusao: data,
      porcentagem: porcentagem
    };
    AppState.tasks.push(newTask);
    showToast('Nova tarefa criada com sucesso!');
  }

  saveTasks();
  closeModal();
  renderApp();
}

window.deleteTask = function(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (confirm(`Deseja realmente remover a tarefa "${task.descricao_etapa}"?`)) {
    AppState.tasks = AppState.tasks.filter(t => t.id !== taskId);
    saveTasks();
    renderApp();
    showToast('Tarefa excluída.');
  }
};

window.quickEditPercent = function(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const input = prompt(`Ajustar progresso de "${task.descricao_etapa}" (0 a 100%):`, task.porcentagem);
  if (input !== null) {
    let val = parseInt(input, 10);
    if (isNaN(val)) return;
    if (val < 0) val = 0;
    if (val > 100) val = 100;
    updateTaskProperty(taskId, { porcentagem: val });
    showToast(`Progresso atualizado para ${val}%`);
  }
};

/**
 * 11. DRAG AND DROP HANDLERS (KANBAN)
 */
function setupKanbanDropZones() {
  const columns = document.querySelectorAll('.kanban-column');
  columns.forEach(col => {
    const list = col.querySelector('.kanban-cards-list');
    const targetStatus = col.dataset.status;

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      list.classList.add('drag-over');
    });

    list.addEventListener('dragleave', () => {
      list.classList.remove('drag-over');
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || AppState.draggedTaskId;
      if (!taskId) return;

      const task = AppState.tasks.find(t => t.id === taskId);
      if (!task) return;

      // Mudar a porcentagem de acordo com a coluna de destino
      let newPercent = task.porcentagem;
      if (targetStatus === 'Não Iniciado') {
        newPercent = 0;
      } else if (targetStatus === 'Em Andamento') {
        if (task.porcentagem === 0 || task.porcentagem === 100) {
          newPercent = 50; // valor padrão ao mover para andamento
        }
      } else if (targetStatus === 'Finalizado') {
        newPercent = 100;
      }

      updateTaskProperty(taskId, { porcentagem: newPercent });
      showToast(`Tarefa movida para "${targetStatus}" (${newPercent}%)`);
    });
  });
}

/**
 * 12. CONTROLE DO MODAL DE TAREFA
 */
function openNewTaskModal() {
  document.getElementById('modal-title').textContent = 'Nova Tarefa de Projeto';
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('form-data').value = '15-08-2026';
  syncModalPercent(0);

  const modal = document.getElementById('task-modal');
  modal.classList.add('open');
  document.getElementById('form-descricao').focus();
}

window.openEditModal = function(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('modal-title').textContent = 'Editar Tarefa de Projeto';
  document.getElementById('task-id').value = task.id;
  document.getElementById('form-descricao').value = task.descricao_etapa;
  document.getElementById('form-disciplina').value = task.disciplina_projeto;
  document.getElementById('form-projetista').value = task.projetista;
  document.getElementById('form-data').value = task.data_conclusao;
  
  syncModalPercent(task.porcentagem);

  const modal = document.getElementById('task-modal');
  modal.classList.add('open');
};

function closeModal() {
  const modal = document.getElementById('task-modal');
  modal.classList.remove('open');
}

function syncModalPercent(val) {
  const slider = document.getElementById('form-porcentagem');
  const numInput = document.getElementById('form-porcentagem-num');
  const display = document.getElementById('form-percent-display');
  const preview = document.getElementById('form-status-preview');

  val = Number(val) || 0;
  if (slider) slider.value = val;
  if (numInput) numInput.value = val;
  if (display) display.textContent = `${val}%`;

  if (preview) {
    const status = calculateStatus(val);
    let previewClass = 'status-nao-iniciado';
    if (status === 'Em Andamento') previewClass = 'status-em-andamento';
    if (status === 'Finalizado') previewClass = 'status-finalizado';

    preview.className = `status-preview-tag ${previewClass}`;
    preview.querySelector('.text').textContent = status;
  }
}

/**
 * 13. NOTIFICAÇÕES TOAST
 */
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * 14. EXPORTAÇÃO E RESET DE DADOS
 */
function resetToSeedData() {
  if (confirm('Deseja restaurar os dados originais do documento "Residência Praia - Pedro"? Todas as alterações locais serão substituídas.')) {
    AppState.tasks = JSON.parse(JSON.stringify(SEED_TASKS));
    saveTasks();
    renderApp();
    showToast('Dados restaurados para o padrão do PDF!');
  }
}

function exportTasksJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(AppState.tasks, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `cronograma_residencia_praia_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Arquivo JSON exportado com sucesso!');
}

/**
 * 15. TEMA CLARO / ESCURO
 */
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  showToast(`Tema alterado para ${next === 'dark' ? 'Escuro' : 'Claro'}`);
}

/**
 * 16. INICIALIZAÇÃO DE EVENT LISTENERS GLOBAIS
 */
function initEventListeners() {
  // 1. Tema
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

  // 2. Ações do Cabeçalho
  const btnReset = document.getElementById('btn-reset-seed');
  if (btnReset) btnReset.addEventListener('click', resetToSeedData);

  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) btnExport.addEventListener('click', exportTasksJSON);

  const btnNewTask = document.getElementById('btn-new-task');
  if (btnNewTask) btnNewTask.addEventListener('click', openNewTaskModal);

  // 3. Modal
  const btnCloseModal = document.getElementById('btn-close-modal');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);

  const btnCancelModal = document.getElementById('btn-cancel-modal');
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

  const taskForm = document.getElementById('task-form');
  if (taskForm) taskForm.addEventListener('submit', saveTaskFromModal);

  // Sincronização de slider de porcentagem no modal
  const modalSlider = document.getElementById('form-porcentagem');
  const modalNum = document.getElementById('form-porcentagem-num');
  if (modalSlider && modalNum) {
    modalSlider.addEventListener('input', (e) => syncModalPercent(e.target.value));
    modalNum.addEventListener('input', (e) => syncModalPercent(e.target.value));
  }

  // 4. Filtro de Vencimento Específico do PDF (Dias)
  const filterDaysInput = document.getElementById('filter-days-input');
  const filterDaysSlider = document.getElementById('filter-days-slider');
  
  if (filterDaysInput && filterDaysSlider) {
    const updateDaysFilter = (val) => {
      AppState.filters.daysLimit = val;
      filterDaysInput.value = val === 'all' ? '' : val;
      if (val !== 'all') filterDaysSlider.value = val;
      
      // Atualiza active chips
      document.querySelectorAll('.quick-presets .btn-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.days === String(val));
      });

      renderApp();
    };

    filterDaysInput.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v) && v > 0) {
        updateDaysFilter(v);
      }
    });

    filterDaysSlider.addEventListener('input', (e) => {
      updateDaysFilter(parseInt(e.target.value, 10));
    });

    // Preset Chips
    document.querySelectorAll('.quick-presets .btn-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const days = chip.dataset.days;
        updateDaysFilter(days === 'all' ? 'all' : parseInt(days, 10));
      });
    });
  }

  // 5. Filtros Dinâmicos (Dropdowns e Busca)
  const filterDisciplina = document.getElementById('filter-disciplina');
  if (filterDisciplina) {
    filterDisciplina.addEventListener('change', (e) => {
      AppState.filters.disciplina = e.target.value;
      renderApp();
    });
  }

  const filterProjetista = document.getElementById('filter-projetista');
  if (filterProjetista) {
    filterProjetista.addEventListener('change', (e) => {
      AppState.filters.projetista = e.target.value;
      renderApp();
    });
  }

  const filterStatus = document.getElementById('filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      AppState.filters.status = e.target.value;
      renderApp();
    });
  }

  const filterSearch = document.getElementById('filter-search');
  if (filterSearch) {
    filterSearch.addEventListener('input', (e) => {
      AppState.filters.search = e.target.value;
      renderApp();
    });
  }

  // 6. Alternador de Visões (Tabs)
  const tabKanban = document.getElementById('tab-kanban');
  const tabDatagrid = document.getElementById('tab-datagrid');
  const viewKanban = document.getElementById('view-kanban');
  const viewDatagrid = document.getElementById('view-datagrid');

  if (tabKanban && tabDatagrid) {
    tabKanban.addEventListener('click', () => {
      AppState.currentView = 'kanban';
      tabKanban.classList.add('active');
      tabDatagrid.classList.remove('active');
      viewKanban.classList.add('active');
      viewDatagrid.classList.remove('active');
      renderApp();
    });

    tabDatagrid.addEventListener('click', () => {
      AppState.currentView = 'datagrid';
      tabDatagrid.classList.add('active');
      tabKanban.classList.remove('active');
      viewDatagrid.classList.add('active');
      viewKanban.classList.remove('active');
      renderApp();
    });
  }

  // 7. Ações de Edição da Ficha Técnica e Dados da Obra
  const btnEditProject = document.getElementById('btn-edit-project');
  if (btnEditProject) btnEditProject.addEventListener('click', openProjectModal);

  const btnQuickEdit = document.getElementById('btn-quick-edit-project');
  if (btnQuickEdit) btnQuickEdit.addEventListener('click', openProjectModal);

  const btnCloseProjectModal = document.getElementById('btn-close-project-modal');
  if (btnCloseProjectModal) btnCloseProjectModal.addEventListener('click', closeProjectModal);

  const btnCancelProjectModal = document.getElementById('btn-cancel-project-modal');
  if (btnCancelProjectModal) btnCancelProjectModal.addEventListener('click', closeProjectModal);

  const formProjectInfo = document.getElementById('form-project-info');
  if (formProjectInfo) formProjectInfo.addEventListener('submit', saveProjectFromModal);

  // Botão "Novo Projeto (Limpar)" no Modal
  const btnModalNew = document.getElementById('btn-modal-new-project');
  if (btnModalNew) {
    btnModalNew.addEventListener('click', () => {
      document.getElementById('form-proj-nome').value = '';
      document.getElementById('form-proj-cliente').value = '';
      document.getElementById('form-proj-local').value = '';
      document.getElementById('form-proj-lotequadra').value = '';
      document.getElementById('form-proj-zona').value = '';
      document.getElementById('form-proj-tipologia').value = '';
      document.getElementById('form-proj-areaconst').value = '';
      document.getElementById('form-proj-areaterreno').value = '';
      document.getElementById('form-proj-inicio').value = '';
      document.getElementById('form-proj-fim').value = '';
      showToast('Campos limpos para preenchimento de nova obra!');
    });
  }

  // Botão "Carregar Exemplo" no Modal
  const btnModalSample = document.getElementById('btn-modal-sample-project');
  if (btnModalSample) {
    btnModalSample.addEventListener('click', () => {
      const p = DEFAULT_PROJECT_INFO;
      document.getElementById('form-proj-nome').value = p.nomeObra;
      document.getElementById('form-proj-cliente').value = p.cliente;
      document.getElementById('form-proj-local').value = p.localizacao;
      document.getElementById('form-proj-lotequadra').value = p.loteQuadra;
      document.getElementById('form-proj-zona').value = p.zona;
      document.getElementById('form-proj-tipologia').value = p.tipologia;
      document.getElementById('form-proj-areaconst').value = p.areaConstruida;
      document.getElementById('form-proj-areaterreno').value = p.areaTerreno;
      document.getElementById('form-proj-inicio').value = p.dataInicio;
      document.getElementById('form-proj-fim').value = p.previsaoConclusao;
      showToast('Dados de exemplo preenchidos no formulário!');
    });
  }

  // 8. Ações de Relatório Executivo PDF
  const btnOpenReport = document.getElementById('btn-open-report');
  if (btnOpenReport) btnOpenReport.addEventListener('click', openReportModal);

  const btnCloseReport = document.getElementById('btn-close-report');
  if (btnCloseReport) btnCloseReport.addEventListener('click', closeReportModal);

  const btnPrintReport = document.getElementById('btn-print-report');
  if (btnPrintReport) btnPrintReport.addEventListener('click', () => window.print());

  const btnDownloadPDF = document.getElementById('btn-download-pdf');
  if (btnDownloadPDF) btnDownloadPDF.addEventListener('click', downloadPDFReport);

  // Configurar Drag and Drop no Kanban
  setupKanbanDropZones();
}

function showAutoSaveIndicator() {
  const indicator = document.getElementById('header-save-indicator');
  if (!indicator) return;
  indicator.innerHTML = '<i data-lucide="check-circle-2"></i> Salvo';
  indicator.style.opacity = '1';
  if (window.lucide) lucide.createIcons();
}

/**
 * MODAL DE EDIÇÃO DE DADOS DA OBRA
 */
function openProjectModal() {
  const p = AppState.projectInfo;
  
  const fNome = document.getElementById('form-proj-nome');
  if (fNome) fNome.value = p.nomeObra || '';

  const fCliente = document.getElementById('form-proj-cliente');
  if (fCliente) fCliente.value = p.cliente || '';

  const fLocal = document.getElementById('form-proj-local');
  if (fLocal) fLocal.value = p.localizacao || '';

  const fLote = document.getElementById('form-proj-lotequadra');
  if (fLote) fLote.value = p.loteQuadra || '';

  const fZona = document.getElementById('form-proj-zona');
  if (fZona) fZona.value = p.zona || '';

  const fTipologia = document.getElementById('form-proj-tipologia');
  if (fTipologia) fTipologia.value = p.tipologia || '';

  const fAreaConst = document.getElementById('form-proj-areaconst');
  if (fAreaConst) fAreaConst.value = p.areaConstruida || '';

  const fAreaTerreno = document.getElementById('form-proj-areaterreno');
  if (fAreaTerreno) fAreaTerreno.value = p.areaTerreno || '';

  const fInicio = document.getElementById('form-proj-inicio');
  if (fInicio) fInicio.value = p.dataInicio || '';

  const fFim = document.getElementById('form-proj-fim');
  if (fFim) fFim.value = p.previsaoConclusao || '';

  const modal = document.getElementById('project-modal');
  if (modal) modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function closeProjectModal() {
  const modal = document.getElementById('project-modal');
  if (modal) modal.classList.remove('open');
}

function saveProjectFromModal(e) {
  e.preventDefault();
  
  const fNome = document.getElementById('form-proj-nome');
  const fCliente = document.getElementById('form-proj-cliente');
  const fLocal = document.getElementById('form-proj-local');
  const fLote = document.getElementById('form-proj-lotequadra');
  const fZona = document.getElementById('form-proj-zona');
  const fTipologia = document.getElementById('form-proj-tipologia');
  const fAreaConst = document.getElementById('form-proj-areaconst');
  const fAreaTerreno = document.getElementById('form-proj-areaterreno');
  const fInicio = document.getElementById('form-proj-inicio');
  const fFim = document.getElementById('form-proj-fim');

  AppState.projectInfo = {
    ...AppState.projectInfo,
    nomeObra: fNome ? fNome.value.trim() : AppState.projectInfo.nomeObra,
    cliente: fCliente ? fCliente.value.trim() : AppState.projectInfo.cliente,
    localizacao: fLocal ? fLocal.value.trim() : AppState.projectInfo.localizacao,
    loteQuadra: fLote ? fLote.value.trim() : AppState.projectInfo.loteQuadra,
    zona: fZona ? fZona.value.trim() : AppState.projectInfo.zona,
    tipologia: fTipologia ? fTipologia.value.trim() : AppState.projectInfo.tipologia,
    areaConstruida: fAreaConst ? fAreaConst.value.trim() : AppState.projectInfo.areaConstruida,
    areaTerreno: fAreaTerreno ? fAreaTerreno.value.trim() : AppState.projectInfo.areaTerreno,
    dataInicio: fInicio ? fInicio.value.trim() : AppState.projectInfo.dataInicio,
    previsaoConclusao: fFim ? fFim.value.trim() : AppState.projectInfo.previsaoConclusao
  };

  saveProjectInfo();
  renderProjectInfo();
  closeProjectModal();
  showToast('Ficha técnica da obra atualizada com sucesso!');
}

/**
 * 17. GERAÇÃO E EXPORTAÇÃO DO RELATÓRIO EXECUTIVO PDF
 */
function openReportModal() {
  populateReportData();
  const modal = document.getElementById('report-modal');
  if (modal) modal.classList.add('open');
  if (window.lucide) lucide.createIcons();
}

function closeReportModal() {
  const modal = document.getElementById('report-modal');
  if (modal) modal.classList.remove('open');
}

function populateReportData() {
  const tasks = AppState.tasks;
  const totalTasks = tasks.length;
  const p = AppState.projectInfo;

  // Atualizar dados cadastrais no relatório
  const repObra = document.getElementById('rep-cad-obra');
  if (repObra) repObra.textContent = p.nomeObra || '-';

  const repCliente = document.getElementById('rep-cad-cliente');
  if (repCliente) repCliente.textContent = p.cliente || '-';

  const repLocal = document.getElementById('rep-cad-local');
  if (repLocal) repLocal.textContent = p.localizacao || '-';

  const repLote = document.getElementById('rep-cad-lote');
  if (repLote) repLote.textContent = p.loteQuadra || '-';

  const repAreaConst = document.getElementById('rep-cad-areaconst');
  if (repAreaConst) repAreaConst.textContent = p.areaConstruida || '-';

  const repAreaTerreno = document.getElementById('rep-cad-areaterreno');
  if (repAreaTerreno) repAreaTerreno.textContent = p.areaTerreno || '-';

  const repZona = document.getElementById('rep-cad-zona');
  if (repZona) repZona.textContent = p.zona || '-';

  const repPrazos = document.getElementById('rep-cad-prazos');
  if (repPrazos) {
    if (p.dataInicio || p.previsaoConclusao) {
      repPrazos.textContent = `${p.dataInicio || '-'} a ${p.previsaoConclusao || '-'}`;
    } else {
      repPrazos.textContent = '-';
    }
  }

  // Atualizar nome na assinatura do cliente no relatório
  const sigClientName = document.querySelector('.signatures-wrapper .signature-box:last-child .signature-name');
  if (sigClientName) sigClientName.textContent = p.cliente || 'Cliente / Contratante';

  // 1. Metadados do Relatório
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dateEmissionElem = document.getElementById('report-date-emission');
  if (dateEmissionElem) dateEmissionElem.textContent = dateStr;

  // 2. Estatísticas Consolidadas
  const sumPercent = tasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0);
  const totalAvg = totalTasks > 0 ? Math.round(sumPercent / totalTasks) : 0;
  const completedTasks = tasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;
  const inProgressTasks = tasks.filter(t => (Number(t.porcentagem) || 0) > 0 && (Number(t.porcentagem) || 0) < 100).length;
  const pendingTasks = tasks.filter(t => (Number(t.porcentagem) || 0) === 0).length;

  const criticalTasks = tasks.filter(t => {
    const status = calculateStatus(t.porcentagem);
    if (status === 'Finalizado') return false;
    const days = getDaysRemaining(t.data_conclusao);
    return days <= 7;
  });

  // Atualizar KPIs do Relatório
  const repTotalVal = document.getElementById('report-kpi-total-val');
  const repTotalBar = document.getElementById('report-kpi-total-bar');
  const repTotalSub = document.getElementById('report-kpi-total-sub');
  if (repTotalVal) repTotalVal.textContent = `${totalAvg}%`;
  if (repTotalBar) {
    repTotalBar.style.width = `${totalAvg}%`;
    repTotalBar.style.backgroundColor = getProgressColor(totalAvg);
  }
  if (repTotalSub) repTotalSub.textContent = `${completedTasks} de ${totalTasks} entregas concluídas`;

  // Disciplinas no Relatório
  const calcDiscReport = (discName, elemPrefix) => {
    const discTasks = tasks.filter(t => t.disciplina_projeto === discName);
    const count = discTasks.length;
    const avg = count > 0 ? Math.round(discTasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0) / count) : 0;
    const done = discTasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;

    const valElem = document.getElementById(`report-kpi-${elemPrefix}-val`);
    const barElem = document.getElementById(`report-kpi-${elemPrefix}-bar`);
    const subElem = document.getElementById(`report-kpi-${elemPrefix}-sub`);

    if (valElem) valElem.textContent = `${avg}%`;
    if (barElem) barElem.style.width = `${avg}%`;
    if (subElem) subElem.textContent = `${done}/${count} concluídas`;
  };

  calcDiscReport('Arquitetura', 'arq');
  calcDiscReport('Estrutura', 'est');
  calcDiscReport('Complementares', 'comp');
  calcDiscReport('Obras', 'obr');

  // Mini Stats
  const statTotal = document.getElementById('stat-total-tasks');
  const statComp = document.getElementById('stat-completed-tasks');
  const statInp = document.getElementById('stat-inprogress-tasks');
  const statPend = document.getElementById('stat-pending-tasks');
  const statCrit = document.getElementById('stat-critical-tasks');

  if (statTotal) statTotal.textContent = totalTasks;
  if (statComp) statComp.textContent = completedTasks;
  if (statInp) statInp.textContent = inProgressTasks;
  if (statPend) statPend.textContent = pendingTasks;
  if (statCrit) statCrit.textContent = criticalTasks.length;

  // Status Geral do Documento
  const docStatusElem = document.getElementById('report-doc-status');
  if (docStatusElem) {
    if (totalAvg >= 100) {
      docStatusElem.textContent = '100% Concluído';
      docStatusElem.style.background = '#d1fae5';
      docStatusElem.style.color = '#065f46';
    } else {
      docStatusElem.textContent = `Em Andamento (${totalAvg}%)`;
      docStatusElem.style.background = '#dbeafe';
      docStatusElem.style.color = '#1e40af';
    }
  }

  // 3. Tabela de Entregas no Relatório
  const tbody = document.getElementById('report-table-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  // Ordenar por data
  const sortedTasks = [...tasks].sort((a, b) => {
    return parseDateBR(a.data_conclusao) - parseDateBR(b.data_conclusao);
  });

  sortedTasks.forEach(task => {
    const status = calculateStatus(task.porcentagem);
    const days = getDaysRemaining(task.data_conclusao);
    const isCritical = status !== 'Finalizado' && days <= 7;
    const progressColor = getProgressColor(task.porcentagem);

    let discClass = 'disc-arq-badge';
    if (task.disciplina_projeto === 'Estrutura') discClass = 'disc-est-badge';
    if (task.disciplina_projeto === 'Complementares') discClass = 'disc-comp-badge';
    if (task.disciplina_projeto === 'Obras') discClass = 'disc-obras-badge';

    let statusStyle = 'background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1;';
    if (status === 'Finalizado') {
      statusStyle = 'background: #dcfce7; color: #14532d; border: 1px solid #86efac;';
    } else if (status === 'Em Andamento') {
      statusStyle = 'background: #dbeafe; color: #1e3a8a; border: 1px solid #93c5fd;';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: #0f172a; font-size: 0.75rem;">${escapeHTML(task.descricao_etapa)}</strong></td>
      <td><span class="report-badge-disc ${discClass}">${escapeHTML(task.disciplina_projeto)}</span></td>
      <td><strong style="color: #1e293b; font-size: 0.75rem;">${escapeHTML(task.projetista)}</strong></td>
      <td>
        <span style="font-family: var(--font-mono); font-weight: 700; color: #0f172a; font-size: 0.75rem;">${escapeHTML(task.data_conclusao)}</span>
        ${isCritical ? `<span style="color: #b91c1c; font-size: 0.6875rem; font-weight: 800; display: block;">⚠️ ${days <= 0 ? 'Atrasada' : days + 'd restantes'}</span>` : ''}
      </td>
      <td>
        <div class="report-table-progress">
          <div class="report-table-track" style="background: #e2e8f0; height: 7px; border-radius: 4px;">
            <div class="report-table-fill" style="width: ${task.porcentagem}%; background-color: ${progressColor}; height: 100%;"></div>
          </div>
          <span class="report-table-percent-text" style="color: #0f172a; font-weight: 800; font-size: 0.75rem;">${task.porcentagem}%</span>
        </div>
      </td>
      <td style="text-align: center;">
        <span style="font-size: 0.6875rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-block; ${statusStyle}">
          ${escapeHTML(status)}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadPDFReport() {
  const element = document.getElementById('report-printable-area');
  if (!element) return;

  showToast('Gerando arquivo PDF...');

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Relatorio_Cronograma_ArqVertice_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('Relatório PDF baixado com sucesso!');
    }).catch(err => {
      console.error('Erro ao gerar PDF:', err);
      // Fallback para impressão caso a biblioteca falhe
      window.print();
    });
  } else {
    // Fallback nativo
    window.print();
  }
}

/**
 * Utilitário para escapar HTML contra XSS
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * INICIALIZAÇÃO DA APLICAÇÃO
 */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadProjectInfo();
  loadTasks();
  initEventListeners();
  renderProjectInfo();
  renderApp();
});
