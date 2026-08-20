/**
 * ============================================================================
 * BRIEFING ARQVÉRTICE — MOTOR
 *
 * Monta a tela a partir de FICHA e ROTEIRO (definidos em roteiro.js), guarda
 * as respostas no navegador e gera as exportações em PDF e JSON.
 * Nenhuma pergunta está escrita aqui nem no HTML.
 * ============================================================================
 */

const CHAVE_RESPOSTAS = 'briefing_arqvertice_respostas_v1';
const CHAVE_TEMA = 'briefing_arqvertice_tema_v1';

/** Estado unico: id da pergunta -> resposta (string ou array). */
let Respostas = {};

/* ==========================================================================
   PERSISTENCIA
   ========================================================================== */
function carregarRespostas() {
  try {
    const bruto = localStorage.getItem(CHAVE_RESPOSTAS);
    Respostas = bruto ? JSON.parse(bruto) : {};
  } catch (e) {
    console.error('Não foi possível ler as respostas salvas:', e);
    Respostas = {};
  }
}

let agendarGravacao = null;
function salvarRespostas() {
  // Digitar dispara a cada tecla: agrupa as gravacoes para nao castigar o disco.
  clearTimeout(agendarGravacao);
  agendarGravacao = setTimeout(() => {
    try {
      localStorage.setItem(CHAVE_RESPOSTAS, JSON.stringify(Respostas));
    } catch (e) {
      console.error('Não foi possível salvar:', e);
    }
  }, 400);
}

/* ==========================================================================
   MONTAGEM DA TELA
   ========================================================================== */
function escapar(txt) {
  return String(txt ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function montarFicha() {
  const grade = document.getElementById('ficha-grade');
  if (!grade) return;

  grade.innerHTML = FICHA.map(c => `
    <div class="campo-envelope">
      <label class="rotulo" for="${c.id}">
        <i data-lucide="${c.icone}"></i> ${escapar(c.rotulo)}
        ${c.dica ? `<span class="rotulo-dica">${escapar(c.dica)}</span>` : ''}
      </label>
      <input type="${c.tipo === 'texto' ? 'text' : c.tipo}" id="${c.id}" name="${c.id}" class="campo"
             value="${escapar(Respostas[c.id] || '')}">
    </div>
  `).join('');
}

function montarPergunta(p, tom) {
  const valor = Respostas[p.id];
  const marcados = Array.isArray(valor) ? valor : (valor ? [valor] : []);

  let corpo = '';

  if (p.tipo === 'longo' || p.tipo === 'texto') {
    corpo = p.tipo === 'longo'
      ? `<textarea class="campo campo-area" data-pergunta="${p.id}" rows="3">${escapar(valor || '')}</textarea>`
      : `<input type="text" class="campo" data-pergunta="${p.id}" value="${escapar(valor || '')}">`;

  } else if (p.tipo === 'radio' || p.tipo === 'checkbox') {
    const entrada = p.tipo === 'radio' ? 'radio' : 'checkbox';
    corpo = `<div class="opcoes">` + p.opcoes.map((o, i) => `
      <label class="opcao ${marcados.includes(o) ? 'marcada' : ''}">
        <input type="${entrada}" name="${p.id}" value="${escapar(o)}" data-pergunta="${p.id}"
               ${marcados.includes(o) ? 'checked' : ''}>
        <span>${escapar(o)}</span>
      </label>
    `).join('') + `</div>`;

  } else if (p.tipo === 'cartoes') {
    corpo = `<div class="cartoes">` + p.cartoes.map(c => `
      <label class="cartao ${marcados.includes(c.valor) ? 'marcada' : ''}">
        <input type="checkbox" name="${p.id}" value="${escapar(c.valor)}" data-pergunta="${p.id}"
               ${marcados.includes(c.valor) ? 'checked' : ''}>
        <span class="cartao-selo"><i data-lucide="check"></i></span>
        <span class="cartao-ilustracao">
          <svg viewBox="0 0 120 80"><use href="#${c.ilustracao}"></use></svg>
        </span>
        <span class="cartao-nome">${escapar(c.valor)}</span>
        <span class="cartao-desc">${escapar(c.desc)}</span>
      </label>
    `).join('') + `</div>`;
  }

  // Campo livre que acompanha algumas perguntas de alternativa.
  const outro = p.outro ? `
    <input type="text" class="campo campo-outro" data-pergunta="${p.id}__outro"
           placeholder="${escapar(p.outro)}: descreva aqui"
           value="${escapar(Respostas[p.id + '__outro'] || '')}">` : '';

  return `
    <div class="pergunta" style="--tom:${tom}">
      <div class="pergunta-titulo">
        <span class="pergunta-num">${p.id.split('_')[0].replace('p', '')}</span>
        <span>${escapar(p.texto)}</span>
      </div>
      ${p.dica ? `<p class="pergunta-dica">${escapar(p.dica)}</p>` : ''}
      ${corpo}
      ${outro}
    </div>
  `;
}

function montarRoteiro() {
  const alvo = document.getElementById('roteiro');
  if (!alvo) return;

  alvo.innerHTML = ROTEIRO.map(parte => `
    <div class="parte-cabecalho">
      <span class="parte-numero">${escapar(parte.parte)}</span>
      <div>
        <h2>${escapar(parte.titulo)}</h2>
        <p>${escapar(parte.subtitulo)}</p>
      </div>
    </div>
    ${parte.secoes.map(s => `
      <section class="secao" style="--tom:${s.tom}" id="secao-${s.id}">
        <div class="secao-cabecalho">
          <span class="secao-icone"><i data-lucide="${s.icone}"></i></span>
          <div>
            <h3>${s.num}. ${escapar(s.titulo)}</h3>
            <p>${escapar(s.resumo)}</p>
          </div>
          <span class="secao-contador" data-secao="${s.id}">0/${s.perguntas.length}</span>
        </div>
        <div class="secao-corpo">
          ${s.perguntas.map(p => montarPergunta(p, s.tom)).join('')}
        </div>
      </section>
    `).join('')}
  `).join('');
}

/* ==========================================================================
   PROGRESSO
   ========================================================================== */
function todasPerguntas() {
  return ROTEIRO.flatMap(parte => parte.secoes.flatMap(s => s.perguntas.map(p => ({ ...p, secao: s.id }))));
}

function respondida(p) {
  const v = Respostas[p.id];
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === 'string' && v.trim() !== '';
}

function atualizarProgresso() {
  const perguntas = todasPerguntas();
  const feitas = perguntas.filter(respondida).length;
  const total = perguntas.length;
  const pct = total ? Math.round((feitas / total) * 100) : 0;

  const texto = document.getElementById('progresso-texto');
  const barra = document.getElementById('progresso-preenchimento');
  const rotulo = document.getElementById('progresso-pct');

  if (texto) texto.textContent = `${feitas} de ${total} respondidas`;
  if (barra) barra.style.width = `${pct}%`;
  if (rotulo) rotulo.textContent = `${pct}%`;

  // Contador por seção
  ROTEIRO.forEach(parte => parte.secoes.forEach(s => {
    const marcador = document.querySelector(`.secao-contador[data-secao="${s.id}"]`);
    if (!marcador) return;
    const n = s.perguntas.filter(respondida).length;
    marcador.textContent = `${n}/${s.perguntas.length}`;
  }));
}

/* ==========================================================================
   EVENTOS
   ========================================================================== */
function registrarEventos() {
  const app = document.querySelector('.app');

  // Um só ouvinte para todos os campos, inclusive os criados depois.
  app.addEventListener('input', e => {
    const alvo = e.target;

    if (alvo.dataset.pergunta && (alvo.tagName === 'TEXTAREA' || alvo.type === 'text')) {
      Respostas[alvo.dataset.pergunta] = alvo.value;
      salvarRespostas();
      atualizarProgresso();
      return;
    }

    if (alvo.classList.contains('campo') && alvo.name && FICHA.some(c => c.id === alvo.name)) {
      Respostas[alvo.name] = alvo.value;
      salvarRespostas();
      return;
    }

    if (alvo.id === 'cli-observacoes') {
      Respostas.cliente_observacoes = alvo.value;
      salvarRespostas();
    }
  });

  app.addEventListener('change', e => {
    const alvo = e.target;
    if (!alvo.dataset.pergunta) return;

    if (alvo.type === 'radio') {
      Respostas[alvo.dataset.pergunta] = alvo.value;
      // Realca a opcao escolhida e apaga o realce das irmas.
      alvo.closest('.opcoes')?.querySelectorAll('.opcao')
        .forEach(o => o.classList.toggle('marcada', o.contains(alvo)));

    } else if (alvo.type === 'checkbox') {
      const nome = alvo.dataset.pergunta;
      const atuais = Array.isArray(Respostas[nome]) ? Respostas[nome] : [];
      Respostas[nome] = alvo.checked
        ? [...new Set([...atuais, alvo.value])]
        : atuais.filter(v => v !== alvo.value);
      alvo.closest('.opcao, .cartao')?.classList.toggle('marcada', alvo.checked);
    }

    salvarRespostas();
    atualizarProgresso();
  });

  document.getElementById('btn-tema')?.addEventListener('click', alternarTema);
  document.getElementById('btn-json')?.addEventListener('click', exportarJSON);
  document.getElementById('btn-pdf')?.addEventListener('click', exportarPDF);
  document.getElementById('btn-limpar')?.addEventListener('click', limparTudo);
}

/* ==========================================================================
   TEMA
   ========================================================================== */
function iniciarTema() {
  const salvo = localStorage.getItem(CHAVE_TEMA) || 'dark';
  document.documentElement.setAttribute('data-theme', salvo);
}

function alternarTema() {
  const atual = document.documentElement.getAttribute('data-theme');
  const novo = atual === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novo);
  localStorage.setItem(CHAVE_TEMA, novo);
}

/* ==========================================================================
   AVISO FLUTUANTE
   ========================================================================== */
let sumirAviso = null;
function avisar(msg) {
  const caixa = document.getElementById('aviso');
  const texto = document.getElementById('aviso-texto');
  if (!caixa || !texto) return;
  texto.textContent = msg;
  caixa.classList.add('visivel');
  clearTimeout(sumirAviso);
  sumirAviso = setTimeout(() => caixa.classList.remove('visivel'), 3200);
}


function limparTudo() {
  if (!confirm('Apagar todas as respostas deste briefing? Esta ação não pode ser desfeita.')) return;
  Respostas = {};
  try { localStorage.removeItem(CHAVE_RESPOSTAS); } catch (e) { /* nada a fazer */ }
  montarFicha();
  montarRoteiro();
  const obs = document.getElementById('cli-observacoes');
  if (obs) obs.value = '';
  atualizarProgresso();
  if (window.lucide) lucide.createIcons();
  avisar('Briefing limpo. Pode começar de novo.');
}

/* ==========================================================================
   ABERTURA
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  iniciarTema();
  carregarRespostas();
  montarFicha();
  montarRoteiro();

  const obs = document.getElementById('cli-observacoes');
  if (obs) obs.value = Respostas.cliente_observacoes || '';

  registrarEventos();
  atualizarProgresso();
  if (window.lucide) lucide.createIcons();
});
