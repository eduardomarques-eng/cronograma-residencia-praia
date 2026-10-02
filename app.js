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
  empresa: 'ArqVértice • Arquitetura, Estrutura & Engenharia',
  pagamentos: []
};

function normalizePagamentos(pagamentos) {
  if (!Array.isArray(pagamentos)) return [];

  return pagamentos.map((item, index) => {
    const valor = Math.max(0, Number(String(item?.valor ?? '0').replace(/[R$\s.]/g, '').replace(',', '.')) || 0);
    const percentual = Math.min(100, Math.max(0, Number(item?.percentual ?? 0) || 0));
    const status = ['pago', 'pendente', 'aguardando'].includes(item?.status) ? item.status : 'pendente';

    return {
      id: item?.id || generateUUID(),
      nome: String(item?.nome || `Pagamento ${index + 1}`).trim() || `Pagamento ${index + 1}`,
      valor,
      percentual,
      status,
      dataVencimento: item?.dataVencimento || '',
      dataPagamento: item?.dataPagamento || '',
      tarefaId: item?.tarefaId || '',
      observacao: item?.observacao || ''
    };
  });
}

function getPaymentSummary(pagamentos = []) {
  const lista = normalizePagamentos(pagamentos);
  const total = lista.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const pagos = lista
    .filter(item => item.status === 'pago')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const pendentes = lista
    .filter(item => item.status !== 'pago')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const proximos = lista
    .filter(item => item.status !== 'pago' && item.dataVencimento)
    .sort((a, b) => parseDateBR(a.dataVencimento) - parseDateBR(b.dataVencimento));
  const historico = lista
    .filter(item => item.status === 'pago')
    .sort((a, b) => parseDateBR(b.dataPagamento || b.dataVencimento) - parseDateBR(a.dataPagamento || a.dataVencimento));

  return {
    total,
    pagos,
    pendentes,
    percentual: total > 0 ? (pagos / total) * 100 : 0,
    parcelas: lista.length,
    proximo: proximos[0] || null,
    historico
  };
}

function normalizeProjectInfo(raw = {}) {
  const base = { ...DEFAULT_PROJECT_INFO, ...(raw || {}) };
  return {
    ...base,
    pagamentos: normalizePagamentos(base.pagamentos)
  };
}

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
    disciplina_projeto: '3D',
    projetista: 'Eduardo Marques',
    data_conclusao: '01-08-2026',
    porcentagem: 30
  },
  {
    id: 'b4b1a8d0-1c32-4e89-9a21-000000000005',
    descricao_etapa: 'Renderização 3D (Imagens Finais)',
    disciplina_projeto: '3D',
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

let projectPaymentsBeforeEdit = null;

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
        AppState.projectInfo = normalizeProjectInfo(parsed);
        return;
      }
    }
  } catch (e) {
    console.error('Erro ao carregar dados do projeto:', e);
  }
  AppState.projectInfo = normalizeProjectInfo(DEFAULT_PROJECT_INFO);
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

function renderPaymentList() {
  const container = document.getElementById('payment-list');
  if (!container) return;

  const pagamentos = normalizePagamentos(AppState.projectInfo?.pagamentos || []);
  const summary = getPaymentSummary(pagamentos);
  const tarefas = Array.isArray(AppState.tasks) ? AppState.tasks : [];

  container.innerHTML = pagamentos.length
    ? pagamentos.map((pagamento, index) => {
      const prefix = `payment-${index}`;
      return `
      <div class="payment-row" data-index="${index}" data-payment-id="${escapeHtml(pagamento.id)}">
        <div class="payment-field payment-name">
          <label for="${prefix}-name">Parcela</label>
          <input type="text" id="${prefix}-name" class="payment-input" data-field="nome" value="${escapeHtml(pagamento.nome)}" placeholder="Ex: Entrada" required>
        </div>
        <div class="payment-field payment-value">
          <label for="${prefix}-value">Valor</label>
          <input type="number" id="${prefix}-value" min="0" step="0.01" class="payment-input" data-field="valor" value="${Number(pagamento.valor || 0).toFixed(2)}">
        </div>
        <div class="payment-field payment-percent">
          <label for="${prefix}-percent">%</label>
          <input type="number" id="${prefix}-percent" min="0" max="100" step="1" class="payment-input" data-field="percentual" value="${Number(pagamento.percentual || 0).toFixed(0)}">
        </div>
        <div class="payment-field payment-status">
          <label for="${prefix}-status">Status</label>
          <select id="${prefix}-status" class="payment-input" data-field="status">
            <option value="pendente" ${pagamento.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="aguardando" ${pagamento.status === 'aguardando' ? 'selected' : ''}>Aguardando etapa</option>
            <option value="pago" ${pagamento.status === 'pago' ? 'selected' : ''}>Pago</option>
          </select>
        </div>
        <div class="payment-field payment-date">
          <label for="${prefix}-due">Data prevista</label>
          <input type="text" id="${prefix}-due" class="payment-input" data-field="dataVencimento" value="${escapeHtml(pagamento.dataVencimento || '')}" placeholder="DD-MM-AAAA" pattern="\\d{2}-\\d{2}-\\d{4}">
        </div>
        <div class="payment-field payment-date-paid">
          <label for="${prefix}-paid">Data paga</label>
          <input type="text" id="${prefix}-paid" class="payment-input" data-field="dataPagamento" value="${escapeHtml(pagamento.dataPagamento || '')}" placeholder="DD-MM-AAAA" pattern="\\d{2}-\\d{2}-\\d{4}">
        </div>
        <div class="payment-field payment-task">
          <label for="${prefix}-task">Etapa relacionada</label>
          <select id="${prefix}-task" class="payment-input" data-field="tarefaId">
            <option value="">Sem etapa vinculada</option>
            ${tarefas.map(tarefa => `<option value="${escapeHtml(tarefa.id)}" ${pagamento.tarefaId === tarefa.id ? 'selected' : ''}>${escapeHtml(tarefa.descricao_etapa)}</option>`).join('')}
          </select>
        </div>
        <div class="payment-field payment-observation">
          <label for="${prefix}-note">Observação</label>
          <input type="text" id="${prefix}-note" class="payment-input" data-field="observacao" value="${escapeHtml(pagamento.observacao || '')}" placeholder="Opcional">
        </div>
        <button type="button" class="btn btn-secondary btn-remove-payment" data-index="${index}" title="Remover parcela" aria-label="Remover ${escapeHtml(pagamento.nome)}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;
    }).join('')
    : '<div class="payment-empty">Nenhuma parcela cadastrada. Adicione a primeira etapa de pagamento.</div>';

  const summaryBox = document.getElementById('payment-summary');
  if (summaryBox) {
    const proximo = summary.proximo
      ? `<strong>${escapeHtml(summary.proximo.nome)}</strong> · ${escapeHtml(summary.proximo.dataVencimento)} · R$ ${formatCurrency(summary.proximo.valor)}`
      : 'Não definido';
    summaryBox.innerHTML = `
      <span>Total: <strong>R$ ${formatCurrency(summary.total)}</strong></span>
      <span>Pago: <strong>R$ ${formatCurrency(summary.pagos)}</strong></span>
      <span>Pendente: <strong>R$ ${formatCurrency(summary.pendentes)}</strong></span>
      <span>Progresso: <strong>${Math.round(summary.percentual)}%</strong></span>
      <span class="payment-next">Próximo pagamento: ${proximo}</span>
    `;
  }

  const historyBox = document.getElementById('payment-history');
  if (historyBox) {
    historyBox.innerHTML = summary.historico.length
      ? `<h4>Pagamentos realizados</h4><ul>${summary.historico.map(pagamento => `
          <li>
            <span><strong>${escapeHtml(pagamento.nome)}</strong>${pagamento.dataPagamento ? ` · ${escapeHtml(pagamento.dataPagamento)}` : ''}</span>
            <strong>R$ ${formatCurrency(pagamento.valor)}</strong>
          </li>
        `).join('')}</ul>`
      : '';
  }

  document.querySelectorAll('.btn-remove-payment').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index || 0);
      const current = collectPaymentRowsFromDOM();
      current.splice(index, 1);
      AppState.projectInfo.pagamentos = current;
      renderPaymentList();
    });
  });

  if (window.lucide) lucide.createIcons();
}

function addPaymentRow() {
  const pagamentos = collectPaymentRowsFromDOM();
  pagamentos.push({
    id: generateUUID(),
    nome: `Pagamento ${pagamentos.length + 1}`,
    valor: 0,
    percentual: 0,
    status: 'pendente',
    dataVencimento: '',
    dataPagamento: '',
    tarefaId: '',
    observacao: ''
  });
  AppState.projectInfo.pagamentos = pagamentos;
  renderPaymentList();
}

function renderPaymentOverview() {
  const container = document.getElementById('payment-overview-summary');
  if (!container) return;

  const pagamentos = normalizePagamentos(AppState.projectInfo?.pagamentos || []);
  const summary = getPaymentSummary(pagamentos);
  const metrics = [
    ['Valor total', summary.total],
    ['Pago', summary.pagos],
    ['Pendente', summary.pendentes]
  ];

  container.innerHTML = metrics.map(([label, value]) => `
    <div class="payment-overview-item">
      <span>${label}</span>
      <strong>${pagamentos.length ? `R$ ${formatCurrency(value)}` : '—'}</strong>
    </div>
  `).join('');

  const nextElement = document.getElementById('payment-overview-next');
  if (!nextElement) return;

  if (!summary.parcelas || !pagamentos.some(item => item.status !== 'pago')) {
    nextElement.textContent = summary.parcelas ? 'Todas as parcelas estão pagas' : 'Próximo pagamento não definido';
    return;
  }

  if (!summary.proximo) {
    nextElement.textContent = 'Próximo pagamento: informe uma data prevista';
    return;
  }

  const tarefa = AppState.tasks.find(item => item.id === summary.proximo.tarefaId);
  const etapa = tarefa ? ` · ${tarefa.descricao_etapa}` : '';
  nextElement.textContent = `Próximo: ${summary.proximo.nome} · ${summary.proximo.dataVencimento} · R$ ${formatCurrency(summary.proximo.valor)}${etapa}`;
}

function collectPaymentRowsFromDOM() {
  const rows = document.querySelectorAll('.payment-row');
  const existentes = normalizePagamentos(AppState.projectInfo?.pagamentos || []);
  return Array.from(rows).map((row, index) => {
    const inputs = row.querySelectorAll('[data-field]');
    const payload = {};

    inputs.forEach(input => {
      const field = input.dataset.field;
      const value = input.value;
      payload[field] = field === 'valor' ? Number(value || 0) : value;
    });

    return {
      id: row.dataset.paymentId || existentes[index]?.id || generateUUID(),
      nome: String(payload.nome || `Pagamento ${index + 1}`).trim() || `Pagamento ${index + 1}`,
      valor: Number(payload.valor || 0),
      percentual: Number(payload.percentual || 0),
      status: ['pago', 'pendente', 'aguardando'].includes(payload.status) ? payload.status : 'pendente',
      dataVencimento: payload.dataVencimento || '',
      dataPagamento: payload.dataPagamento || '',
      tarefaId: payload.tarefaId || '',
      observacao: payload.observacao || ''
    };
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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

          // Migração: 3D deixou de ser subitem de Arquitetura e virou disciplina própria.
          let disc = t.disciplina_projeto;
          if (disc === 'Arquitetura' && /3d/i.test(t.descricao_etapa || '')) disc = '3D';

          return { ...t, projetista: proj, disciplina_projeto: disc };
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

  PHASE_MODEL.forEach(m => calcDiscipline(m.disciplina, m.key));

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
  const colunas = [
    { status: 'Não Iniciado', listId: 'list-nao-iniciado', countId: 'count-nao-iniciado' },
    { status: 'Em Andamento', listId: 'list-em-andamento', countId: 'count-em-andamento' },
    { status: 'Finalizado',   listId: 'list-finalizado',   countId: 'count-finalizado' }
  ];

  colunas.forEach(coluna => {
    const lista = document.getElementById(coluna.listId);
    if (!lista) return;

    lista.innerHTML = '';

    const tarefasDaColuna = filteredTasks.filter(t => calculateStatus(t.porcentagem) === coluna.status);

    const contador = document.getElementById(coluna.countId);
    if (contador) contador.textContent = tarefasDaColuna.length;

    if (tarefasDaColuna.length === 0) {
      lista.innerHTML = '<div class="kanban-col-empty">Nenhuma etapa neste estágio</div>';
      return;
    }

    // Dentro de cada coluna as etapas ficam agrupadas por disciplina, na ordem
    // do cronograma: Arquitetura, 3D, Estrutural, Complementares e Obra.
    PHASE_MODEL.forEach(model => {
      const doGrupo = tarefasDaColuna.filter(t => t.disciplina_projeto === model.disciplina);
      if (doGrupo.length === 0) return;

      const media = averagePercent(doGrupo);

      const grupo = document.createElement('div');
      grupo.className = `kanban-group group-${model.key}`;
      grupo.innerHTML = `
        <div class="kanban-group-head">
          <span class="kanban-group-icon"><i data-lucide="${model.icon}"></i></span>
          <span class="kanban-group-name">${escapeHTML(model.nome)}</span>
          <span class="kanban-group-count">${doGrupo.length}</span>
          <span class="kanban-group-avg">${media}%</span>
        </div>
      `;

      doGrupo.forEach(task => grupo.appendChild(buildKanbanCard(task)));
      lista.appendChild(grupo);
    });

    // Disciplinas fora do modelo (cadastradas manualmente) não podem sumir.
    const conhecidas = PHASE_MODEL.map(m => m.disciplina);
    const orfas = tarefasDaColuna.filter(t => !conhecidas.includes(t.disciplina_projeto));
    if (orfas.length > 0) {
      const grupo = document.createElement('div');
      grupo.className = 'kanban-group group-outros';
      grupo.innerHTML = `
        <div class="kanban-group-head">
          <span class="kanban-group-icon"><i data-lucide="folder"></i></span>
          <span class="kanban-group-name">Outras disciplinas</span>
          <span class="kanban-group-count">${orfas.length}</span>
          <span class="kanban-group-avg">${averagePercent(orfas)}%</span>
        </div>
      `;
      orfas.forEach(task => grupo.appendChild(buildKanbanCard(task)));
      lista.appendChild(grupo);
    }
  });
}

/**
 * Monta o card de uma etapa, já com os eventos de arrastar-e-soltar.
 */
function buildKanbanCard(task) {
  const status = calculateStatus(task.porcentagem);
  const statusKey = status === 'Finalizado' ? 'completed' : status === 'Em Andamento' ? 'in-progress' : 'not-started';
  const statusIcon = status === 'Finalizado' ? 'check-circle-2' : status === 'Em Andamento' ? 'clock-3' : 'circle';
  const days = getDaysRemaining(task.data_conclusao);
  const isCritical = status !== 'Finalizado' && days <= 7;
  const progressColor = getProgressColor(task.porcentagem);
  const discKey = getDisciplinaKey(task.disciplina_projeto);

  const card = document.createElement('article');
  card.className = `kanban-card ${isCritical ? 'card-critical' : ''}`;
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.setAttribute('aria-label', `${task.descricao_etapa}, ${status}, ${task.porcentagem}%, prazo ${task.data_conclusao}`);

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

  card.innerHTML = `
    <div class="card-top-row">
      <span class="badge-disciplina badge-${discKey}">${escapeHTML(task.disciplina_projeto)}</span>
      <div class="card-state-group">
        <span class="card-status status-${statusKey}">
          <i data-lucide="${statusIcon}"></i>
          ${escapeHTML(status)}
        </span>
      ${isCritical ? `
        <span class="card-alert-badge" title="Prazo crítico: ${days < 0 ? 'Vencida há ' + Math.abs(days) + ' dias' : 'Vence em ' + days + ' dias'}">
          <i data-lucide="alert-circle"></i>
          ${days < 0 ? 'Atrasada' : days + 'd'}
        </span>
      ` : ''}
      </div>
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
      <div class="custom-progress-track" role="progressbar" aria-label="Progresso de ${escapeHTML(task.descricao_etapa)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Number(task.porcentagem) || 0}">
        <div class="custom-progress-bar" style="width: ${task.porcentagem}%; background-color: ${progressColor};"></div>
      </div>
    </div>

    <div class="card-footer-actions">
      <button type="button" class="btn-card-action" onclick="quickEditPercent('${task.id}')" title="Ajustar Porcentagem" aria-label="Ajustar progresso de ${escapeHTML(task.descricao_etapa)}">
        <i data-lucide="percent"></i>
      </button>
      <button type="button" class="btn-card-action" onclick="openEditModal('${task.id}')" title="Editar Tarefa" aria-label="Editar ${escapeHTML(task.descricao_etapa)}">
        <i data-lucide="edit-3"></i>
      </button>
      <button type="button" class="btn-card-action danger" onclick="deleteTask('${task.id}')" title="Excluir Tarefa" aria-label="Excluir ${escapeHTML(task.descricao_etapa)}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;

  return card;
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
    const discBadgeClass = 'badge-' + getDisciplinaKey(task.disciplina_projeto);

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
                 aria-label="Prazo de ${escapeHTML(task.descricao_etapa)}"
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
               aria-label="Progresso de ${escapeHTML(task.descricao_etapa)}"
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
          <button type="button" class="btn-card-action" onclick="openEditModal('${task.id}')" title="Editar Tarefa Completa" aria-label="Editar ${escapeHTML(task.descricao_etapa)}">
            <i data-lucide="edit"></i>
          </button>
          <button type="button" class="btn-card-action danger" onclick="deleteTask('${task.id}')" title="Excluir Tarefa" aria-label="Excluir ${escapeHTML(task.descricao_etapa)}">
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
  renderPaymentOverview();

  // Renderiza a visão ativa
  if (AppState.currentView === 'kanban') {
    renderKanban(filtered);
  } else {
    renderDataGrid(filtered);
  }

  // Painel de leitura do cliente: fases, equipe técnica e resumos do Kanban
  if (typeof renderPainelCliente === 'function') {
    renderPainelCliente(filtered);
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

    // Espelha no banco. No modo local isso e um no-op.
    if (typeof Remoto !== 'undefined') Remoto.atualizarTarefa(taskId, updates);
  }
}

function saveTaskFromModal(e) {
  e.preventDefault();

  const id = document.getElementById('form-task-id').value;
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

  const campos = {
    descricao_etapa: descricao,
    disciplina_projeto: disciplina,
    projetista: projetista,
    data_conclusao: data,
    porcentagem: porcentagem
  };

  if (id) {
    // Edição
    const index = AppState.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      AppState.tasks[index] = { ...AppState.tasks[index], ...campos };
      showToast('Tarefa atualizada com sucesso!');
      if (typeof Remoto !== 'undefined') Remoto.atualizarTarefa(id, campos);
    }
  } else {
    // Nova Tarefa
    const newTask = { id: generateUUID(), ...campos };
    AppState.tasks.push(newTask);
    showToast('Nova tarefa criada com sucesso!');
    if (typeof Remoto !== 'undefined') Remoto.criarTarefa(newTask);
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

    if (typeof Remoto !== 'undefined') Remoto.removerTarefa(taskId);
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
  document.getElementById('form-task-id').value = '';
  document.getElementById('form-data').value = '15-08-2026';
  syncModalPercent(0);

  const modal = document.getElementById('task-modal');
  openDialog(modal, '#form-descricao');
}

window.openEditModal = function(taskId) {
  const task = AppState.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('modal-title').textContent = 'Editar Tarefa de Projeto';
  document.getElementById('form-task-id').value = task.id;
  document.getElementById('form-descricao').value = task.descricao_etapa;
  document.getElementById('form-disciplina').value = task.disciplina_projeto;
  document.getElementById('form-projetista').value = task.projetista;
  document.getElementById('form-data').value = task.data_conclusao;
  
  syncModalPercent(task.porcentagem);

  const modal = document.getElementById('task-modal');
  openDialog(modal, '#btn-close-modal');
};

function closeModal() {
  const modal = document.getElementById('task-modal');
  closeDialog(modal);
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
  // No modo nuvem o banco e a fonte da verdade: restaurar so o cache local
  // daria a ilusao de ter funcionado e seria desfeito no proximo carregamento.
  if (typeof Remoto !== 'undefined' && Remoto.modo === 'nuvem') {
    alert(
      'O cronograma está vindo do banco de dados, então a restauração não pode ser feita por aqui — ' +
      'ela seria desfeita no próximo carregamento.\n\n' +
      'Para recarregar os dados originais, rode novamente o arquivo database/schema.sql na base.'
    );
    return;
  }

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

const modalFocusReturn = new WeakMap();

function openDialog(modal, initialFocusSelector) {
  if (!modal) return;
  if (!modal.classList.contains('open')) modalFocusReturn.set(modal, document.activeElement);
  modal.classList.add('open');

  const target = modal.querySelector(initialFocusSelector || '.btn-close') || modal.querySelector('[role="dialog"]');
  if (target) target.focus({ preventScroll: true });
  if (window.lucide) lucide.createIcons();
}

function closeDialog(modal) {
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('open');

  const returnFocus = modalFocusReturn.get(modal);
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  modalFocusReturn.delete(modal);
}

function getOpenDialog() {
  return [...document.querySelectorAll('.modal-overlay.open')].pop() || null;
}

function keepFocusInsideDialog(event, modal) {
  const focusable = [...modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(element => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  if (!focusable.length) {
    event.preventDefault();
    modal.querySelector('[role="dialog"]')?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * 16. INICIALIZAÇÃO DE EVENT LISTENERS GLOBAIS
 */
function initEventListeners() {
  document.addEventListener('keydown', event => {
    const modal = getOpenDialog();
    if (!modal) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog(modal);
    } else if (event.key === 'Tab') {
      keepFocusInsideDialog(event, modal);
    }
  });

  // 1. Tema
  const btnTheme = document.getElementById('btn-theme-toggle');
  if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

  // Selo de origem dos dados: clicar pede/limpa a chave de administrador
  const seloDados = document.getElementById('indicador-dados');
  if (seloDados) {
    seloDados.addEventListener('click', () => {
      if (typeof Remoto === 'undefined') return;
      if (Remoto.modo !== 'nuvem') {
        alert(
          'Nenhum banco de dados configurado para este endereço.\n\n' +
          'As alterações estão sendo salvas apenas neste navegador — o cliente não as vê. ' +
          'Configure DATABASE_URL e ADMIN_KEY na Vercel para ligar a nuvem.'
        );
        return;
      }
      Remoto.pedirChave();
    });
  }

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

  const btnManagePayments = document.getElementById('btn-manage-payments');
  if (btnManagePayments) btnManagePayments.addEventListener('click', openProjectModal);

  const btnQuickEdit = document.getElementById('btn-quick-edit-project');
  if (btnQuickEdit) btnQuickEdit.addEventListener('click', openProjectModal);

  const btnCloseProjectModal = document.getElementById('btn-close-project-modal');
  if (btnCloseProjectModal) btnCloseProjectModal.addEventListener('click', () => closeProjectModal(true));

  const btnCancelProjectModal = document.getElementById('btn-cancel-project-modal');
  if (btnCancelProjectModal) btnCancelProjectModal.addEventListener('click', () => closeProjectModal(true));

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
      AppState.projectInfo.pagamentos = [];
      renderPaymentList();
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
      AppState.projectInfo.pagamentos = normalizePagamentos(p.pagamentos);
      renderPaymentList();
      showToast('Dados de exemplo preenchidos no formulário!');
    });
  }

  const btnAddPayment = document.getElementById('btn-add-payment');
  if (btnAddPayment) btnAddPayment.addEventListener('click', addPaymentRow);

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
  projectPaymentsBeforeEdit = normalizePagamentos(p.pagamentos).map(item => ({ ...item }));
  
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

  renderPaymentList();

  const modal = document.getElementById('project-modal');
  openDialog(modal, '#btn-close-project-modal');
}

function closeProjectModal(discard = false) {
  if (discard && projectPaymentsBeforeEdit) {
    AppState.projectInfo.pagamentos = projectPaymentsBeforeEdit;
    renderPaymentList();
    renderPaymentOverview();
  }
  projectPaymentsBeforeEdit = null;
  const modal = document.getElementById('project-modal');
  closeDialog(modal);
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
  const pagamentos = collectPaymentRowsFromDOM();

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
    previsaoConclusao: fFim ? fFim.value.trim() : AppState.projectInfo.previsaoConclusao,
    pagamentos: normalizePagamentos(pagamentos)
  };

  saveProjectInfo();
  renderProjectInfo();
  renderPaymentList();
  renderPaymentOverview();
  projectPaymentsBeforeEdit = null;
  closeProjectModal();
  showToast('Ficha técnica da obra atualizada com sucesso!');

  if (typeof Remoto !== 'undefined') Remoto.salvarProjeto(AppState.projectInfo);
}

/**
 * 17. GERAÇÃO E EXPORTAÇÃO DO RELATÓRIO EXECUTIVO PDF
 */
function openReportModal() {
  populateReportData();
  const modal = document.getElementById('report-modal');
  openDialog(modal, '#btn-close-report');
}

function closeReportModal() {
  const modal = document.getElementById('report-modal');
  closeDialog(modal);
}

function renderPaymentReport() {
  const pagamentos = normalizePagamentos(AppState.projectInfo?.pagamentos || []);
  const summary = getPaymentSummary(pagamentos);
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText('report-finance-total', pagamentos.length ? `R$ ${formatCurrency(summary.total)}` : '—');
  setText('report-finance-paid', pagamentos.length ? `R$ ${formatCurrency(summary.pagos)}` : '—');
  setText('report-finance-pending', pagamentos.length ? `R$ ${formatCurrency(summary.pendentes)}` : '—');

  if (summary.proximo) {
    const tarefa = AppState.tasks.find(item => item.id === summary.proximo.tarefaId);
    const etapa = tarefa ? ` · etapa: ${tarefa.descricao_etapa}` : '';
    setText('report-finance-next', `Próximo pagamento: ${summary.proximo.nome} · ${summary.proximo.dataVencimento} · R$ ${formatCurrency(summary.proximo.valor)}${etapa}`);
  } else {
    setText('report-finance-next', summary.parcelas && summary.pendentes > 0
      ? 'Há parcelas pendentes sem data prevista.'
      : 'Próximo pagamento não definido.');
  }

  const tbody = document.getElementById('report-payment-tbody');
  if (!tbody) return;

  tbody.innerHTML = pagamentos.length
    ? pagamentos.map(pagamento => {
      const tarefa = AppState.tasks.find(item => item.id === pagamento.tarefaId);
      const status = pagamento.status === 'pago'
        ? 'Pago'
        : pagamento.status === 'aguardando'
          ? 'Aguardando etapa'
          : 'Pendente';

      return `
        <tr>
          <td>${escapeHTML(pagamento.nome)}</td>
          <td>${escapeHTML(pagamento.dataVencimento || '—')}</td>
          <td>${escapeHTML(pagamento.dataPagamento || '—')}</td>
          <td>${escapeHTML(tarefa?.descricao_etapa || '—')}</td>
          <td>${status}</td>
          <td>R$ ${formatCurrency(pagamento.valor)}</td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="6">Nenhuma parcela cadastrada.</td></tr>';
}

function populateReportData() {
  if (typeof renderRelatorioCliente === 'function') {
    renderRelatorioCliente();
  }

  const tasks = AppState.tasks;
  const totalTasks = tasks.length;
  const p = AppState.projectInfo;
  renderPaymentReport();

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

  PHASE_MODEL.forEach(m => calcDiscReport(m.disciplina, m.key));

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

    const discClass = 'disc-' + getDisciplinaKey(task.disciplina_projeto) + '-badge';

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

  // Nome do arquivo carrega a obra e a data — o cliente costuma acumular versões.
  const slugObra = (AppState.projectInfo?.nomeObra || 'Obra')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Cronograma_${slugObra}_${new Date().toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // Evita que uma seção, uma linha da tabela ou o bloco de assinaturas
    // sejam cortados ao meio na virada de página.
    pagebreak: {
      mode: ['css', 'legacy'],
      avoid: ['.report-section-block', '.report-kpi-box', 'tr', '.signatures-wrapper']
    }
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

  // A tela ja esta pronta com o cache local. So agora vamos a rede: se houver
  // banco, ele substitui o que esta na tela; se nao houver, nada muda.
  if (typeof iniciarSincronizacao === 'function') {
    iniciarSincronizacao();
  }
});
