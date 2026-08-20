/**
 * ============================================================================
 * BRIEFING ARQVÉRTICE — ENTREVISTA DE PROJETO
 *
 * O roteiro inteiro vive na constante ROTEIRO abaixo. Para incluir, remover ou
 * reescrever uma pergunta basta editar esse objeto: a tela, o progresso, o JSON
 * e o PDF se ajustam sozinhos. Nenhuma pergunta esta escrita no HTML.
 * ============================================================================
 */

const CHAVE_RESPOSTAS = 'briefing_arqvertice_respostas_v1';
const CHAVE_TEMA = 'briefing_arqvertice_tema_v1';

/** Identificacao preenchida na abertura da reuniao. */
const FICHA = [
  { id: 'cliente_nome',      rotulo: 'Nome do cliente',        icone: 'user',        tipo: 'texto', dica: 'Quem contrata o projeto' },
  { id: 'cliente_email',     rotulo: 'E-mail',                 icone: 'mail',        tipo: 'email' },
  { id: 'cliente_telefone',  rotulo: 'Telefone / WhatsApp',    icone: 'phone',       tipo: 'texto' },
  { id: 'projeto_tipo',      rotulo: 'Tipo de projeto',        icone: 'building-2',  tipo: 'texto', dica: 'Residencial, comercial, reforma...' },
  { id: 'projeto_local',     rotulo: 'Endereço / localização', icone: 'map-pin',     tipo: 'texto' },
  { id: 'briefing_data',     rotulo: 'Data da entrevista',     icone: 'calendar',    tipo: 'date' }
];

const ROTEIRO = [
  {
    parte: 'Parte 1',
    titulo: 'Entrevista aberta',
    subtitulo: 'Perguntas para o cliente falar à vontade. Anote com as palavras dele.',
    secoes: [
      {
        num: 1, id: 'perfil', tom: 'var(--c-perfil)', icone: 'users',
        titulo: 'Perfil dos Moradores ou Usuários',
        resumo: 'Entender a dinâmica de quem vai usar o espaço dita o fluxo do projeto.',
        perguntas: [
          { id: 'p1_quem', tipo: 'longo', texto: 'Quem vai habitar ou utilizar o espaço?', dica: 'Idade, profissão e hobbies de cada um.' },
          { id: 'p1_rotina', tipo: 'longo', texto: 'Como é a rotina da casa ou do comércio?', dica: 'Passam muito tempo fora? Trabalham em home office? Cozinham com frequência?' },
          { id: 'p1_visitas', tipo: 'longo', texto: 'Costumam receber visitas?', dica: 'Festas grandes, jantares íntimos, hóspedes que dormem no local?' },
          { id: 'p1_animais', tipo: 'longo', texto: 'Existem animais de estimação?', dica: 'Quais, portes e se precisam de espaços específicos.' },
          { id: 'p1_acessibilidade', tipo: 'longo', texto: 'Há alguma necessidade de acessibilidade ou cuidado especial?', dica: 'Idosos, cadeirantes, crianças pequenas.' }
        ]
      },
      {
        num: 2, id: 'terreno', tom: 'var(--c-terreno)', icone: 'map',
        titulo: 'O Terreno ou O Imóvel',
        resumo: 'Informações técnicas para iniciar a análise de viabilidade e as limitações do espaço.',
        perguntas: [
          { id: 'p2_natureza', tipo: 'radio', texto: 'O projeto é uma construção do zero, uma reforma completa ou uma intervenção de interiores?',
            opcoes: ['Construção do zero', 'Reforma completa', 'Intervenção de interiores'] },
          { id: 'p2_plantas', tipo: 'checkbox', texto: 'Você possui as plantas atuais do local?',
            dica: 'Marque o que já existe e pode ser enviado.',
            opcoes: ['Levantamento topográfico', 'Planta de arquitetura', 'Projeto estrutural', 'Projeto elétrico', 'Projeto hidrossanitário', 'Não possuo nenhuma planta'] },
          { id: 'p2_condominio', tipo: 'longo', texto: 'O local faz parte de um condomínio?', dica: 'Se sim, existem restrições de horário, dias de obra ou regras rigorosas de fachada?' },
          { id: 'p2_gosta', tipo: 'longo', texto: 'Quais as características que você mais gosta e menos gosta no terreno/imóvel atual?', dica: 'Ex.: "gosto da ventilação, odeio a falta de luz na sala".' }
        ]
      },
      {
        num: 3, id: 'programa', tom: 'var(--c-programa)', icone: 'layout-grid',
        titulo: 'Programa de Necessidades',
        resumo: 'A lista prática dos espaços e funções que o projeto precisa abrigar.',
        perguntas: [
          { id: 'p3_indispensaveis', tipo: 'longo', texto: 'Quais ambientes são indispensáveis para você?' },
          { id: 'p3_sonho', tipo: 'longo', texto: 'Existe algum espaço com uma função muito específica que você sonha em ter?', dica: 'Ex.: um espaço gourmet integrado, uma academia em casa, um estúdio, um quarto gamer.' },
          { id: 'p3_distribuicao', tipo: 'longo', texto: 'Como você prefere a distribuição dos ambientes?', dica: 'Conceito aberto com tudo integrado ou cômodos mais setorizados e privativos?' },
          { id: 'p3_armazenamento', tipo: 'longo', texto: 'Qual a sua necessidade de armazenamento?', dica: 'Muitas roupas, livros, equipamentos esportivos, louças volumosas?' }
        ]
      },
      {
        num: 4, id: 'estetica', tom: 'var(--c-estilo)', icone: 'palette',
        titulo: 'Estilo, Estética e Iluminação',
        resumo: 'O direcionamento visual para a modelagem 3D e a especificação de materiais.',
        perguntas: [
          { id: 'p4_estilos', tipo: 'longo', texto: 'Quais estilos de arquitetura ou decoração mais chamam a sua atenção?', dica: 'Minimalista, industrial, rústico, praiano/resort, contemporâneo?' },
          { id: 'p4_sensacoes', tipo: 'longo', texto: 'Quais sensações você quer que o ambiente transmita?', dica: 'Aconchego, energia, sofisticação, tranquilidade.' },
          { id: 'p4_materiais', tipo: 'longo', texto: 'Quais cores e materiais você ama e quais você detesta?', dica: 'Madeira, concreto aparente, pedras naturais, metais escuros.' },
          { id: 'p4_iluminacao', tipo: 'longo', texto: 'Como você prefere a iluminação dos ambientes?', dica: 'Gosta de luzes mais quentes e indiretas para relaxar, ou prefere ambientes muito claros e iluminados por igual?' },
          { id: 'p4_referencias', tipo: 'longo', texto: 'Você tem imagens de referência para compartilhar?', dica: 'Pinterest, Instagram — cole os links aqui.' }
        ]
      },
      {
        num: 5, id: 'orcamento', tom: 'var(--c-orcamento)', icone: 'wallet',
        titulo: 'Orçamento e Prazos',
        resumo: 'Alinhamento de realidade para que as especificações caibam no bolso do cliente.',
        perguntas: [
          { id: 'p5_investimento', tipo: 'longo', texto: 'Qual é a estimativa de investimento (teto máximo) para a execução da obra?' },
          { id: 'p5_prazo', tipo: 'longo', texto: 'Existe uma data limite ou prazo ideal para a finalização do projeto e entrega da obra?', dica: 'Ex.: nascimento de um filho, inauguração de uma loja.' }
        ]
      }
    ]
  },
  {
    parte: 'Parte 2',
    titulo: 'Questionário objetivo',
    subtitulo: 'As mesmas frentes, agora em alternativas — para fechar o escopo sem ambiguidade.',
    secoes: [
      {
        num: 6, id: 'uso', tom: 'var(--c-perfil)', icone: 'home',
        titulo: 'Perfil e Uso do Espaço',
        resumo: 'A natureza do uso define normas, fluxos e materiais.',
        perguntas: [
          { id: 'p6_uso', tipo: 'radio', texto: 'Qual é o uso principal do projeto?',
            opcoes: ['Residencial (Casa/Apartamento)', 'Comercial / Hospitalidade (Loja, Pousada, Restaurante)', 'Misto ou Outro'] },
          { id: 'p6_usuarios', tipo: 'longo', texto: 'Quem utilizará o espaço no dia a dia?',
            dica: 'Descreva brevemente quem são as pessoas, idades, ou o público-alvo, se for comercial.' },
          { id: 'p6_animais', tipo: 'radio', texto: 'Existem animais de estimação no local?',
            opcoes: ['Não', 'Sim, cachorro(s)', 'Sim, gato(s)'], outro: 'Outros' }
        ]
      },
      {
        num: 7, id: 'estilo', tom: 'var(--c-estilo)', icone: 'sparkles',
        titulo: 'Estilo e Estética',
        resumo: 'Direcionamento visual do projeto. Escolha pelas imagens.',
        perguntas: [
          { id: 'p7_estilos', tipo: 'cartoes', texto: 'Qual destes estilos arquitetônicos mais atrai você?', dica: 'Pode marcar mais de um.',
            cartoes: [
              { valor: 'Minimalista',        ilustracao: 'ilu-minimalista',   desc: 'Linhas limpas, essencial, sem excessos' },
              { valor: 'Rústico / Praiano',  ilustracao: 'ilu-rustico',       desc: 'Madeira, fibras naturais, estilo resort' },
              { valor: 'Industrial',         ilustracao: 'ilu-industrial',    desc: 'Cimento queimado, metais, tijolinhos, conduletes' },
              { valor: 'Contemporâneo',      ilustracao: 'ilu-contemporaneo', desc: 'Moderno, elegante, vidros, pedras' },
              { valor: 'Clássico',           ilustracao: 'ilu-classico',      desc: 'Molduras, lustres, acabamentos tradicionais' }
            ] },
          { id: 'p7_paleta', tipo: 'radio', texto: 'Qual a sua preferência geral para a paleta de cores e acabamentos?',
            opcoes: [
              'Tons neutros e claros (Branco, bege, cinza claro)',
              'Tons escuros e sóbrios (Preto, grafite, madeiras escuras)',
              'Base neutra com toques de cores vivas',
              'Texturas naturais (Muita madeira, linho, pedras)'
            ] },
          { id: 'p7_detesta', tipo: 'longo', texto: 'Existe algum material ou cor que você DETESTA e não quer ver no projeto de jeito nenhum?' }
        ]
      },
      {
        num: 8, id: 'layout', tom: 'var(--c-programa)', icone: 'layout-dashboard',
        titulo: 'Programa de Necessidades e Layout',
        resumo: 'Ambientes especiais e o grau de integração entre as áreas sociais.',
        perguntas: [
          { id: 'p8_ambientes', tipo: 'cartoes', texto: 'Você deseja incluir algum destes ambientes especiais no projeto?', dica: 'Pode marcar vários.',
            outro: 'Outro ambiente especial',
            cartoes: [
              { valor: 'Academia particular / Home Gym',    ilustracao: 'ilu-gym',     desc: 'Área de treino com equipamentos fixos' },
              { valor: 'Quarto Gamer / Estúdio de gravação', ilustracao: 'ilu-gamer',  desc: 'Tratamento acústico, cabeamento e iluminação cênica' },
              { valor: 'Home Office completo',              ilustracao: 'ilu-office',  desc: 'Estação de trabalho, marcenaria e luz de tarefa' },
              { valor: 'Espaço Gourmet / Churrasqueira',    ilustracao: 'ilu-gourmet', desc: 'Bancada, coifa, exaustão e apoio para receber' },
              { valor: 'Outro ambiente a definir',          ilustracao: 'ilu-outro',   desc: 'Descreva no campo abaixo' }
            ] },
          { id: 'p8_integracao', tipo: 'radio', texto: 'Como você prefere a integração dos ambientes sociais?',
            opcoes: [
              '100% Integrado (Cozinha, sala de estar e jantar em um espaço único)',
              'Parcialmente Integrado (Ex.: Cozinha fechada, mas salas unidas)',
              'Ambientes totalmente separados e privativos'
            ] },
          { id: 'p8_cozinha', tipo: 'longo', texto: 'O que não pode faltar de jeito nenhum na sua cozinha ou área molhada?',
            dica: 'Ex.: ilha central, cuba dupla, espaço para lava-louças de chão.' }
        ]
      },
      {
        num: 9, id: 'conforto', tom: 'var(--c-conforto)', icone: 'lightbulb',
        titulo: 'Iluminação e Conforto',
        resumo: 'Temperatura de luz e nível de automação definem o projeto elétrico.',
        perguntas: [
          { id: 'p9_luz', tipo: 'radio', texto: 'Como você prefere a iluminação principal dos ambientes de permanência (salas e quartos)?',
            opcoes: [
              'Quente e aconchegante (Amarelada, indireta, clima relaxante)',
              'Fria e clara (Branca, foco em máxima visibilidade)',
              'Mista (Luz clara para trabalho e limpeza, e luzes pontuais quentes para relaxar)'
            ] },
          { id: 'p9_automacao', tipo: 'radio', texto: 'Qual o nível de investimento em automação residencial você deseja?',
            opcoes: [
              'Nenhum, prefiro o sistema tradicional (interruptores padrão)',
              'Básico (Apenas controle de iluminação via Alexa/Google ou assistente virtual)',
              'Completo (Luzes, ar-condicionado, cortinas, fechaduras e câmeras)'
            ] }
        ]
      },
      {
        num: 10, id: 'investimento', tom: 'var(--c-orcamento)', icone: 'banknote',
        titulo: 'Investimento e Prazos',
        resumo: 'A faixa de investimento orienta cada especificação daqui para frente.',
        perguntas: [
          { id: 'p10_orcamento', tipo: 'radio', texto: 'Qual a estimativa de orçamento (teto) para a execução completa da obra/interiores?',
            opcoes: [
              'Até R$ 50.000',
              'De R$ 50.000 a R$ 150.000',
              'De R$ 150.000 a R$ 300.000',
              'Acima de R$ 300.000',
              'Ainda não tenho ideia, preciso da orientação do arquiteto'
            ] }
        ]
      }
    ]
  }
];

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

/* ==========================================================================
   EXPORTACOES
   ========================================================================== */
function nomeArquivo(extensao) {
  const cliente = (Respostas.cliente_nome || 'Cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Briefing_ArqVertice_${cliente}_${new Date().toISOString().slice(0, 10)}.${extensao}`;
}

function exportarJSON() {
  const pacote = {
    escritorio: 'ArqVértice • Arquitetura, Estrutura & Engenharia',
    geradoEm: new Date().toISOString(),
    cliente: Object.fromEntries(FICHA.map(c => [c.id, Respostas[c.id] || ''])),
    observacoes: Respostas.cliente_observacoes || '',
    respostas: todasPerguntas().map(p => ({
      secao: p.secao,
      pergunta: p.texto,
      resposta: Respostas[p.id] ?? '',
      complemento: Respostas[p.id + '__outro'] || undefined
    }))
  };

  const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo('json');
  a.click();
  URL.revokeObjectURL(url);
  avisar('Respostas exportadas em JSON.');
}

/** Monta o documento em folha branca e manda para o html2pdf. */
function montarDocumentoPDF() {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const fichaHTML = FICHA.map(c => `
    <div style="border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;">
      <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">${escapar(c.rotulo)}</div>
      <div style="font-size:11px;font-weight:700;color:#0f172a;">${escapar(Respostas[c.id] || '—')}</div>
    </div>
  `).join('');

  const secoesHTML = ROTEIRO.map(parte => `
    <div style="margin:16px 0 8px;padding:6px 10px;background:#0f172a;color:#fff;border-radius:5px;">
      <span style="font-size:9px;font-weight:800;letter-spacing:.08em;">${escapar(parte.parte.toUpperCase())} — ${escapar(parte.titulo.toUpperCase())}</span>
    </div>
    ${parte.secoes.map(s => `
      <div class="bloco-pdf" style="margin-bottom:12px;">
        <div style="font-size:11.5px;font-weight:900;color:#0f172a;border-left:4px solid #334155;padding-left:8px;margin-bottom:6px;">
          ${s.num}. ${escapar(s.titulo.toUpperCase())}
        </div>
        ${s.perguntas.map(p => {
          const v = Respostas[p.id];
          const extra = Respostas[p.id + '__outro'];
          let resp = Array.isArray(v) ? v.join(' · ') : (v || '');
          if (extra) resp = resp ? `${resp} · ${extra}` : extra;
          const vazia = !resp || !String(resp).trim();
          return `
            <div style="margin-bottom:7px;padding-bottom:6px;border-bottom:1px dotted #cbd5e1;">
              <div style="font-size:10px;font-weight:700;color:#334155;">${escapar(p.texto)}</div>
              <div style="font-size:11px;color:${vazia ? '#94a3b8' : '#0f172a'};font-style:${vazia ? 'italic' : 'normal'};white-space:pre-wrap;margin-top:2px;">
                ${vazia ? 'Não respondido' : escapar(resp)}
              </div>
            </div>`;
        }).join('')}
      </div>
    `).join('')}
  `).join('');

  return `
    <div style="font-family:Montserrat,Arial,sans-serif;color:#0f172a;background:#fff;padding:26px 30px;">

      <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:58px;height:58px;border:2px solid #0f172a;border-radius:7px;padding:3px;">
            <img src="logo.png" style="width:100%;height:100%;object-fit:contain;">
          </div>
          <div>
            <div style="font-size:17px;font-weight:900;letter-spacing:-.02em;">BRIEFING DE PROJETO</div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#0f172a;">ArqVértice • Arquitetura, Estrutura &amp; Engenharia</div>
            <div style="font-size:9px;color:#475569;font-weight:600;">Entrevista guiada para definição de escopo, estilo e investimento.</div>
          </div>
        </div>
        <div style="text-align:right;font-size:9px;color:#334155;">
          <div><strong>Emissão:</strong> ${hoje}</div>
          <div><strong>Preenchido:</strong> ${document.getElementById('progresso-pct')?.textContent || '—'}</div>
        </div>
      </div>

      <div class="bloco-pdf" style="margin-bottom:14px;">
        <div style="font-size:11.5px;font-weight:900;border-left:4px solid #334155;padding-left:8px;margin-bottom:7px;">IDENTIFICAÇÃO DO CLIENTE</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">${fichaHTML}</div>
        <div style="margin-top:9px;border:1px solid #cbd5e1;border-left:5px solid #334155;border-radius:6px;padding:9px 11px;">
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">Observações e pedidos do cliente</div>
          <div style="font-size:11px;white-space:pre-wrap;color:${Respostas.cliente_observacoes ? '#0f172a' : '#94a3b8'};font-style:${Respostas.cliente_observacoes ? 'normal' : 'italic'};">${escapar(Respostas.cliente_observacoes || 'Sem observações registradas.')}</div>
        </div>
      </div>

      ${secoesHTML}

      <div style="margin-top:18px;padding-top:10px;border-top:2px solid #0f172a;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:9px;color:#334155;">
        <div><strong style="color:#0f172a;">Eduardo Marques</strong><br>Arquiteto Projetista</div>
        <div><strong style="color:#0f172a;">Luan Almeida</strong><br>Engenheiro Calculista</div>
        <div><strong style="color:#0f172a;">Erick Santiago</strong><br>Engenheiro de Obra</div>
      </div>
    </div>
  `;
}

function exportarPDF() {
  const area = document.getElementById('area-pdf');
  if (!area) return;

  area.innerHTML = montarDocumentoPDF();
  avisar('Gerando o briefing em PDF...');

  const opcoes = {
    margin: [8, 8, 8, 8],
    filename: nomeArquivo('pdf'),
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    // Evita cortar uma seção no meio da virada de página.
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.bloco-pdf'] }
  };

  if (window.html2pdf) {
    html2pdf().set(opcoes).from(area).save()
      .then(() => avisar('Briefing em PDF gerado.'))
      .catch(err => {
        console.error('Falha ao gerar PDF:', err);
        avisar('Não foi possível gerar o PDF. Tente novamente.');
      });
  } else {
    window.print();
  }
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
