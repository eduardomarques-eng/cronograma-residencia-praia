/**
 * ============================================================================
 * PAINEL DO CLIENTE — CRONOGRAMA ARQVÉRTICE
 * Camada de leitura que traduz a lista de tarefas em "onde o projeto está agora".
 * Alimenta a faixa de fases, o bloco de equipe técnica e os resumos do Kanban.
 * ============================================================================
 */

/**
 * Disciplinas do empreendimento, na ordem em que aparecem no cronograma de
 * referência: arquitetura, 3D, estrutura, complementares e, por fim, a obra.
 * Esta lista é a fonte única de verdade — faixa de fases, agrupamento do
 * Kanban, chips de resumo e relatório em PDF leem todos daqui.
 */
const PHASE_MODEL = [
  { key: 'arq',  disciplina: 'Arquitetura',    nome: 'Arquitetura',      icon: 'pencil-ruler', resumo: 'Estudo preliminar, projeto básico e executivo' },
  { key: '3d',   disciplina: '3D',             nome: 'Projeto 3D',       icon: 'box',          resumo: 'Modelagem tridimensional e imagens finais' },
  { key: 'est',  disciplina: 'Estrutura',      nome: 'Projeto Estrutural', icon: 'frame',      resumo: 'Fundação, formas e armaduras' },
  { key: 'comp', disciplina: 'Complementares', nome: 'Complementares',   icon: 'zap',          resumo: 'Elétrico e hidrossanitário (água, esgoto e drenagem)' },
  { key: 'obr',  disciplina: 'Obras',          nome: 'Execução da Obra', icon: 'hard-hat',     resumo: 'Canteiro, execução e acompanhamento em campo' }
];

/**
 * Classe CSS do badge de cada disciplina, usada pelos cards do Kanban e pela
 * tabela de controle.
 */
function getDisciplinaKey(disciplina) {
  const model = PHASE_MODEL.find(m => m.disciplina === disciplina);
  return model ? model.key : 'arq';
}

// Equipe técnica: cargo é fixo, carga de trabalho é calculada a partir das tarefas.
const TEAM_ROSTER = [
  { nome: 'Eduardo Marques', iniciais: 'EM', cargo: 'Arquiteto Projetista',  discKey: 'arq', avatarClass: 'avatar-eduardo' },
  { nome: 'Luan Almeida',    iniciais: 'LA', cargo: 'Engenheiro Calculista', discKey: 'est', avatarClass: 'avatar-luan' },
  { nome: 'Erick Santiago',  iniciais: 'ES', cargo: 'Engenheiro de Obra',    discKey: 'obr', avatarClass: 'avatar-erick' }
];

function averagePercent(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, t) => acc + (Number(t.porcentagem) || 0), 0);
  return Math.round(sum / tasks.length);
}

/**
 * Monta o retrato das fases e aponta em qual delas o empreendimento está hoje.
 * Regra: a fase atual é a primeira que ainda não fechou 100%. Se uma fase
 * anterior travou, ela continua sendo a atual — o cliente precisa enxergar o
 * gargalo real, não a próxima da fila.
 */
function computePhases() {
  const phases = PHASE_MODEL.map(model => {
    const tasks = AppState.tasks.filter(t => t.disciplina_projeto === model.disciplina);
    const pct = averagePercent(tasks);
    const concluidas = tasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;

    let estado = 'Aguardando';
    if (tasks.length > 0 && pct >= 100) estado = 'Concluída';
    else if (pct > 0) estado = 'Em Andamento';

    return { ...model, tasks, pct, concluidas, total: tasks.length, estado, atual: false };
  });

  const comEtapas = phases.filter(f => f.total > 0);
  const atual = comEtapas.find(f => f.pct < 100) || comEtapas[comEtapas.length - 1];
  if (atual) atual.atual = true;

  return phases;
}

/**
 * Próximas entregas: o que ainda não fechou, da data mais próxima para a mais distante.
 */
function getProximasEntregas(limite) {
  return AppState.tasks
    .filter(t => (Number(t.porcentagem) || 0) < 100)
    .sort((a, b) => parseDateBR(a.data_conclusao) - parseDateBR(b.data_conclusao))
    .slice(0, limite || 3);
}

/**
 * Frase de resumo executivo — a leitura que o cliente faz em cinco segundos.
 */
function buildResumoExecutivo() {
  const phases = computePhases();
  const atual = phases.find(f => f.atual);
  const geral = averagePercent(AppState.tasks);
  const concluidas = AppState.tasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;
  const atrasadas = AppState.tasks.filter(t => {
    if ((Number(t.porcentagem) || 0) === 100) return false;
    return getDaysRemaining(t.data_conclusao) < 0;
  }).length;

  let frase = `O empreendimento está com ${geral}% de avanço geral, com ${concluidas} de ${AppState.tasks.length} entregas concluídas.`;
  if (atual) {
    frase += ` A fase em curso é ${atual.nome}, com ${atual.pct}% executado (${atual.concluidas} de ${atual.total} etapas fechadas).`;
  }
  if (atrasadas > 0) {
    frase += ` ${atrasadas} ${atrasadas === 1 ? 'entrega está' : 'entregas estão'} com prazo vencido e em recuperação.`;
  } else {
    frase += ' Não há entregas com prazo vencido.';
  }
  return frase;
}

/**
 * FAIXA DE FASES — o bloco "estamos aqui" do painel.
 */
function renderPhaseStrip() {
  const track = document.getElementById('fase-track');
  const nowTag = document.getElementById('fase-now-tag');
  const detail = document.getElementById('fase-detail');
  if (!track) return;

  const phases = computePhases();
  const atual = phases.find(f => f.atual);

  track.innerHTML = phases.map((f, i) => {
    let stateClass = 'is-wait';
    if (f.estado === 'Concluída') stateClass = 'is-done';
    else if (f.estado === 'Em Andamento') stateClass = 'is-running';
    if (f.atual) stateClass += ' is-atual';

    return `
      <div class="fase-step ${stateClass} fase-tone-${f.key}">
        ${f.atual ? '<span class="fase-you-are-here"><i data-lucide="map-pin"></i> Estamos aqui</span>' : ''}
        <div class="fase-step-top">
          <span class="fase-step-num">${i + 1}</span>
          <span class="fase-step-icon"><i data-lucide="${f.icon}"></i></span>
          <span class="fase-step-state">${escapeHTML(f.estado)}</span>
        </div>
        <h3 class="fase-step-name">${escapeHTML(f.nome)}</h3>
        <p class="fase-step-resumo">${escapeHTML(f.resumo)}</p>
        <div class="fase-step-bar-row">
          <div class="fase-step-track"><div class="fase-step-fill" style="width:${f.pct}%"></div></div>
          <span class="fase-step-pct">${f.pct}%</span>
        </div>
        <span class="fase-step-count">${f.concluidas} de ${f.total} ${f.total === 1 ? 'etapa concluída' : 'etapas concluídas'}</span>
      </div>
    `;
  }).join('');

  if (nowTag) {
    nowTag.innerHTML = atual
      ? `<span class="fase-now-label">Fase atual</span>
         <strong class="fase-now-name">${escapeHTML(atual.nome)}</strong>
         <span class="fase-now-pct">${atual.pct}%</span>`
      : '';
  }

  if (!detail) return;

  const emCurso = atual
    ? atual.tasks.filter(t => {
        const p = Number(t.porcentagem) || 0;
        return p > 0 && p < 100;
      })
    : [];
  const proximas = getProximasEntregas(3);

  const emCursoHTML = emCurso.length
    ? `<ul class="fase-detail-list">${emCurso.map(t => `
        <li><span class="fdl-name">${escapeHTML(t.descricao_etapa)}</span><span class="fdl-pct">${t.porcentagem}%</span></li>
      `).join('')}</ul>`
    : '<p class="fase-detail-empty">Nenhuma etapa iniciada nesta fase até o momento.</p>';

  const proximasHTML = proximas.length
    ? `<ul class="fase-detail-list">${proximas.map(t => {
        const d = getDaysRemaining(t.data_conclusao);
        const atrasada = d < 0;
        const sufixo = atrasada ? ' · atrasada' : ` · ${d}d`;
        return `<li>
          <span class="fdl-name">${escapeHTML(t.descricao_etapa)}</span>
          <span class="fdl-date ${atrasada ? 'is-late' : ''}">${escapeHTML(t.data_conclusao)}${sufixo}</span>
        </li>`;
      }).join('')}</ul>`
    : '<p class="fase-detail-empty">Todas as entregas foram concluídas.</p>';

  detail.innerHTML = `
    <div class="fase-detail-col">
      <span class="fase-detail-title"><i data-lucide="loader"></i> Em execução nesta fase</span>
      ${emCursoHTML}
    </div>
    <div class="fase-detail-col">
      <span class="fase-detail-title"><i data-lucide="calendar-clock"></i> Próximas entregas</span>
      ${proximasHTML}
    </div>
    <div class="fase-detail-col fase-detail-resumo">
      <span class="fase-detail-title"><i data-lucide="file-text"></i> Resumo executivo</span>
      <p class="fase-resumo-text">${escapeHTML(buildResumoExecutivo())}</p>
    </div>
  `;
}

/**
 * EQUIPE TÉCNICA — quem responde por cada projeto, com a carga real de cada um.
 */
function renderTeamBlock() {
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  grid.innerHTML = TEAM_ROSTER.map(pessoa => {
    const tasks = AppState.tasks.filter(t => t.projetista === pessoa.nome);
    const pct = averagePercent(tasks);
    const done = tasks.filter(t => (Number(t.porcentagem) || 0) === 100).length;

    // Disciplinas sob responsabilidade, na ordem das fases.
    const disciplinas = PHASE_MODEL.filter(m => tasks.some(t => t.disciplina_projeto === m.disciplina));

    const emCurso = tasks.filter(t => {
      const p = Number(t.porcentagem) || 0;
      return p > 0 && p < 100;
    });

    const chipsHTML = disciplinas.length
      ? disciplinas.map(d => `<span class="team-disc-chip chip-${d.key}">${escapeHTML(d.nome)}</span>`).join('')
      : '<span class="team-disc-chip chip-none">Sem etapas atribuídas</span>';

    const agoraHTML = emCurso.length
      ? `<span class="team-now" title="${escapeHTML(emCurso.map(t => t.descricao_etapa).join(' · '))}">
           <i data-lucide="activity"></i> ${escapeHTML(emCurso[0].descricao_etapa)}${emCurso.length > 1 ? ` +${emCurso.length - 1}` : ''}
         </span>`
      : '<span class="team-now team-now-idle">Sem etapa em execução</span>';

    return `
      <article class="team-card disc-${pessoa.discKey}-border">
        <header class="team-card-head">
          <div class="exec-avatar ${pessoa.avatarClass}">${escapeHTML(pessoa.iniciais)}</div>
          <div class="exec-names">
            <span class="exec-title">${escapeHTML(pessoa.nome)}</span>
            <span class="exec-subtitle">${escapeHTML(pessoa.cargo)}</span>
          </div>
          <span class="team-card-pct">${pct}%</span>
        </header>

        <div class="team-disc-row">${chipsHTML}</div>

        <div class="team-card-track"><div class="team-card-fill fill-${pessoa.discKey}" style="width:${pct}%"></div></div>

        <div class="team-card-foot">
          <span><strong>${done}</strong> de <strong>${tasks.length}</strong> entregas concluídas</span>
          ${agoraHTML}
        </div>
      </article>
    `;
  }).join('');
}

/**
 * RESUMOS DAS COLUNAS DO KANBAN — cada coluna se explica sozinha.
 */
function renderKanbanSummaries(filteredTasks) {
  const grupos = {
    'Não Iniciado': { el: 'summary-nao-iniciado', tasks: [] },
    'Em Andamento': { el: 'summary-em-andamento', tasks: [] },
    'Finalizado':   { el: 'summary-finalizado',   tasks: [] }
  };

  filteredTasks.forEach(t => {
    const s = calculateStatus(t.porcentagem);
    if (grupos[s]) grupos[s].tasks.push(t);
  });

  Object.keys(grupos).forEach(status => {
    const box = document.getElementById(grupos[status].el);
    if (!box) return;

    const tasks = grupos[status].tasks;
    if (tasks.length === 0) {
      box.innerHTML = '<span class="ks-empty">Nenhuma etapa neste estágio</span>';
      return;
    }

    const pct = averagePercent(tasks);

    // Distribuição por disciplina, na ordem das fases.
    const chips = PHASE_MODEL.map(m => {
      const n = tasks.filter(t => t.disciplina_projeto === m.disciplina).length;
      return n > 0 ? `<span class="ks-chip chip-${m.key}">${escapeHTML(m.nome)} <strong>${n}</strong></span>` : '';
    }).filter(Boolean).join('');

    // Prazo mais próximo entre as etapas ainda abertas.
    let prazoHTML = '<span class="ks-prazo is-done"><i data-lucide="check-circle-2"></i> Entregues e aprovadas</span>';
    if (status !== 'Finalizado') {
      const proxima = [...tasks].sort((a, b) => parseDateBR(a.data_conclusao) - parseDateBR(b.data_conclusao))[0];
      const d = getDaysRemaining(proxima.data_conclusao);
      const atrasada = d < 0;
      prazoHTML = `<span class="ks-prazo ${atrasada ? 'is-late' : ''}">
        <i data-lucide="${atrasada ? 'alert-triangle' : 'calendar'}"></i>
        ${atrasada ? `Atrasada há ${Math.abs(d)}d` : `Próxima em ${d}d`}: ${escapeHTML(proxima.descricao_etapa)}
      </span>`;
    }

    box.innerHTML = `
      <div class="ks-top">
        <span class="ks-avg">Média <strong>${pct}%</strong></span>
        <div class="ks-track"><div class="ks-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="ks-chips">${chips}</div>
      ${prazoHTML}
    `;
  });
}

/**
 * Ponto único de atualização do painel do cliente, chamado a cada re-render.
 */
function renderPainelCliente(filteredTasks) {
  renderPhaseStrip();
  renderTeamBlock();
  renderKanbanSummaries(filteredTasks);
}

/**
 * ============================================================================
 * BLOCOS DO RELATÓRIO EM PDF
 * O documento é impresso em folha branca, então as cores vão inline em tons
 * de alto contraste — as variáveis de tema do app não valem aqui.
 * ============================================================================
 */

// Paleta de impressão de cada disciplina (escura o bastante para papel).
const PHASE_PRINT_COLORS = {
  arq:  { forte: '#6d28d9', claro: '#ede9fe' },
  '3d': { forte: '#9d174d', claro: '#fce7f3' },
  est:  { forte: '#b45309', claro: '#fef3c7' },
  comp: { forte: '#0e7490', claro: '#cffafe' },
  obr:  { forte: '#c2410c', claro: '#ffedd5' }
};

/**
 * Faixa de fases na versão impressa do relatório.
 */
function renderReportPhaseStrip() {
  const box = document.getElementById('report-fase-track');
  if (!box) return;

  box.innerHTML = computePhases().map((f, i) => {
    const cor = PHASE_PRINT_COLORS[f.key] || PHASE_PRINT_COLORS.arq;
    const destaque = f.atual;

    const marcador = destaque
      ? `<div style="background:${cor.forte}; color:#ffffff; font-size:0.55rem; font-weight:900; text-transform:uppercase; letter-spacing:0.06em; text-align:center; padding:2px 0; border-radius:3px; margin-bottom:5px;">ESTAMOS AQUI</div>`
      : '<div style="height:15px; margin-bottom:5px;"></div>';

    return `
      <div style="background:${destaque ? cor.claro : '#ffffff'}; border:${destaque ? '2.5px' : '1.5px'} solid ${cor.forte}; border-radius:7px; padding:8px 9px;">
        ${marcador}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
          <span style="font-size:0.6rem; font-weight:900; color:${cor.forte};">${i + 1}. ${escapeHTML(f.nome)}</span>
        </div>
        <div style="font-size:1.05rem; font-weight:900; color:${cor.forte}; line-height:1.1; margin:2px 0 4px;">${f.pct}%</div>
        <div style="background:#e2e8f0; height:6px; border-radius:3px; overflow:hidden;">
          <div style="width:${f.pct}%; background:${cor.forte}; height:100%;"></div>
        </div>
        <div style="font-size:0.6rem; font-weight:800; color:#334155; margin-top:4px;">${escapeHTML(f.estado)}</div>
        <div style="font-size:0.575rem; font-weight:600; color:#475569;">${f.concluidas} de ${f.total} ${f.total === 1 ? 'etapa' : 'etapas'}</div>
      </div>
    `;
  }).join('');
}

/**
 * Parecer técnico calculado a partir das etapas reais — nada de texto fixo,
 * que envelheceria a cada atualização do cronograma.
 */
function renderReportParecer() {
  const box = document.getElementById('report-parecer');
  if (!box) return;

  const p = AppState.projectInfo || {};
  const concluidas = AppState.tasks.filter(t => (Number(t.porcentagem) || 0) === 100);
  const emCurso = AppState.tasks
    .filter(t => {
      const v = Number(t.porcentagem) || 0;
      return v > 0 && v < 100;
    })
    .sort((a, b) => (Number(b.porcentagem) || 0) - (Number(a.porcentagem) || 0));
  const aIniciar = AppState.tasks
    .filter(t => (Number(t.porcentagem) || 0) === 0)
    .sort((a, b) => parseDateBR(a.data_conclusao) - parseDateBR(b.data_conclusao));
  const atrasadas = AppState.tasks.filter(t => {
    if ((Number(t.porcentagem) || 0) === 100) return false;
    return getDaysRemaining(t.data_conclusao) < 0;
  });

  const lista = (tarefas, comPct) => tarefas
    .map(t => `${escapeHTML(t.descricao_etapa)}${comPct ? ` (${t.porcentagem}%)` : ''}`)
    .join(', ');

  const linha = (cor, rotulo, conteudo) =>
    `<div>• <strong style="color:${cor};">${rotulo}</strong> ${conteudo}</div>`;

  const blocos = [];

  if (concluidas.length) {
    blocos.push(linha('#14532d', 'Etapas concluídas (100%):', lista(concluidas, false) + '.'));
  }
  if (emCurso.length) {
    blocos.push(linha('#1e3a8a', 'Etapas em desenvolvimento ativo:', lista(emCurso, true) + '.'));
  }
  if (aIniciar.length) {
    blocos.push(linha('#c2410c', 'Próximas fases programadas:', lista(aIniciar.slice(0, 6), false) + '.'));
  }
  if (atrasadas.length) {
    blocos.push(linha('#b91c1c', 'Entregas com prazo vencido:',
      `${lista(atrasadas, true)}. Estas etapas estão em regime de recuperação de prazo.`));
  }

  box.innerHTML = `
    <p style="margin:0 0 8px 0; color:#020617;">
      Prezado cliente <strong style="color:#020617;">${escapeHTML(p.cliente || 'Cliente')}</strong>,
      o presente relatório consolida o acompanhamento físico de projetos e o planejamento executivo da sua
      <strong style="color:#020617;">${escapeHTML(p.nomeObra || 'obra')}</strong>.
    </p>
    <p style="margin:0 0 8px 0; color:#0f172a; font-weight:600;">${escapeHTML(buildResumoExecutivo())}</p>
    <div style="color:#0f172a; display:flex; flex-direction:column; gap:4px;">${blocos.join('')}</div>
  `;
}

/**
 * Ponto único de atualização dos blocos novos do relatório.
 */
function renderRelatorioCliente() {
  renderReportPhaseStrip();
  renderReportParecer();
}
