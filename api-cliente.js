/**
 * ============================================================================
 * CLIENTE DA API — PONTE ENTRE O NAVEGADOR E O POSTGRES
 *
 * Dois modos de operacao:
 *   'local' — sem banco configurado. Tudo vive no localStorage, como antes.
 *             O app inteiro continua funcionando; nada quebra.
 *   'nuvem' — banco respondendo. O servidor passa a ser a fonte da verdade e
 *             o localStorage vira apenas cache para abrir rapido e offline.
 *
 * Leitura e publica (o cliente da obra acompanha pelo link).
 * Escrita exige a chave de administrador, guardada so neste navegador.
 * ============================================================================
 */

const CHAVE_ADMIN_KEY = 'cronograma_chave_admin_v1';

const Remoto = {
  modo: 'local',
  sincronizando: false,
  ultimoErro: null,

  /** A chave nunca vai para o código: fica no navegador de quem administra. */
  get chave() {
    try {
      return localStorage.getItem(CHAVE_ADMIN_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  set chave(valor) {
    try {
      if (valor) localStorage.setItem(CHAVE_ADMIN_KEY, valor);
      else localStorage.removeItem(CHAVE_ADMIN_KEY);
    } catch (e) {
      console.warn('Nao foi possivel guardar a chave:', e);
    }
  },

  get podeEscrever() {
    return this.modo === 'nuvem' && Boolean(this.chave);
  },

  cabecalhos() {
    const h = { 'Content-Type': 'application/json' };
    if (this.chave) h['x-chave-admin'] = this.chave;
    return h;
  },

  async requisitar(url, opcoes = {}) {
    const resp = await fetch(url, { ...opcoes, headers: this.cabecalhos() });
    let corpo = null;
    try {
      corpo = await resp.json();
    } catch (e) {
      corpo = null;
    }
    if (!resp.ok) {
      const msg = corpo?.erro || `HTTP ${resp.status}`;
      const erro = new Error(msg);
      erro.status = resp.status;
      erro.detalhes = corpo?.detalhes;
      throw erro;
    }
    return corpo;
  },

  /**
   * Descobre em que modo o app deve rodar. Chamado uma vez na abertura.
   * Qualquer falha aqui e tratada como "sem banco" — nunca impede o app de abrir.
   */
  async detectar() {
    try {
      const resp = await fetch('/api/status', { cache: 'no-store' });
      if (!resp.ok) return 'local';

      const s = await resp.json();
      if (s.databaseUrlConfigurada && s.esquemaAplicado && s.banco === 'conectado') {
        this.modo = 'nuvem';
      } else {
        this.modo = 'local';
        this.ultimoErro = s.detalhe || s.banco;
      }
    } catch (e) {
      // Site estatico puro (GitHub Pages) ou offline: /api nao existe.
      this.modo = 'local';
    }
    return this.modo;
  },

  /**
   * Puxa o estado do servidor para dentro do AppState.
   * Retorna true se algo veio do banco.
   */
  async carregar() {
    if (this.modo !== 'nuvem') return false;

    const [tarefas, projeto] = await Promise.all([
      this.requisitar('/api/tarefas'),
      this.requisitar('/api/projeto')
    ]);

    if (Array.isArray(tarefas?.tarefas)) {
      AppState.tasks = tarefas.tarefas.map(t => ({
        id: t.id,
        descricao_etapa: t.descricao_etapa,
        disciplina_projeto: t.disciplina_projeto,
        projetista: t.projetista,
        data_conclusao: t.data_conclusao,
        porcentagem: Number(t.porcentagem) || 0
      }));
      saveTasks(); // atualiza o cache local
    }

    if (projeto?.projeto) {
      AppState.projectInfo = { ...DEFAULT_PROJECT_INFO, ...projeto.projeto };
      saveProjectInfo();
    }

    return true;
  },

  /**
   * As quatro operacoes de escrita. Todas silenciosas no modo local — o app
   * segue gravando no localStorage e nada aqui atrapalha.
   */
  async criarTarefa(tarefa) {
    if (!this.podeEscrever) return;
    await this.requisitar('/api/tarefas', { method: 'POST', body: JSON.stringify(tarefa) })
      .catch(e => this.avisarFalha('criar a etapa', e));
  },

  async atualizarTarefa(id, campos) {
    if (!this.podeEscrever) return;
    await this.requisitar(`/api/tarefas?id=${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(campos)
    }).catch(e => this.avisarFalha('atualizar a etapa', e));
  },

  async removerTarefa(id) {
    if (!this.podeEscrever) return;
    await this.requisitar(`/api/tarefas?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .catch(e => this.avisarFalha('remover a etapa', e));
  },

  async salvarProjeto(info) {
    if (!this.podeEscrever) return;
    await this.requisitar('/api/projeto', { method: 'PUT', body: JSON.stringify(info) })
      .catch(e => this.avisarFalha('salvar os dados da obra', e));
  },

  avisarFalha(acao, erro) {
    console.error(`Falha ao ${acao}:`, erro);
    const motivo = erro.status === 401
      ? 'chave de administrador invalida'
      : (erro.message || 'servidor indisponivel');
    if (typeof showToast === 'function') {
      showToast(`Não foi possível ${acao} na nuvem (${motivo}). A alteração ficou salva neste navegador.`);
    }
  },

  /** Pede a chave e valida gravando nada — apenas testa com um PUT vazio proibido. */
  async pedirChave() {
    const atual = this.chave;
    const nova = window.prompt(
      'Chave de administrador (permite editar o cronograma na nuvem).\n' +
      'Deixe em branco para sair do modo de edição.',
      atual
    );
    if (nova === null) return;

    this.chave = nova.trim();
    atualizarIndicadorDados();

    if (!this.chave) {
      showToast('Modo somente leitura. Este navegador não edita mais a nuvem.');
      return;
    }

    // Confirma a chave com uma escrita inofensiva (regrava a ficha atual).
    try {
      await this.requisitar('/api/projeto', {
        method: 'PUT',
        body: JSON.stringify({ nomeObra: AppState.projectInfo.nomeObra })
      });
      showToast('Chave aceita. Suas edições agora vão para a nuvem.');
    } catch (e) {
      showToast(e.status === 401 ? 'Chave recusada pelo servidor.' : `Não foi possível validar: ${e.message}`);
    }
    atualizarIndicadorDados();
  }
};

/**
 * Selo no cabecalho dizendo de onde vem o dado. Sem isso e impossivel saber
 * se o que esta na tela e compartilhado ou so deste navegador.
 */
function atualizarIndicadorDados() {
  const el = document.getElementById('indicador-dados');
  if (!el) return;

  if (Remoto.modo === 'nuvem') {
    const editavel = Remoto.podeEscrever;
    el.className = `indicador-dados ${editavel ? 'is-nuvem-admin' : 'is-nuvem'}`;
    el.innerHTML = `
      <i data-lucide="${editavel ? 'cloud-cog' : 'cloud'}"></i>
      <span>${editavel ? 'Nuvem · edição liberada' : 'Nuvem · somente leitura'}</span>
    `;
    el.title = editavel
      ? 'Os dados vêm do banco e suas alterações são salvas para todos.'
      : 'Os dados vêm do banco. Informe a chave de administrador para editar.';
  } else {
    el.className = 'indicador-dados is-local';
    el.innerHTML = '<i data-lucide="hard-drive"></i><span>Local · só neste navegador</span>';
    el.title = 'Sem banco configurado. As alterações ficam apenas neste navegador.';
  }

  if (window.lucide) lucide.createIcons();
}

/**
 * Abertura: o app ja renderizou com o cache local; aqui trocamos pelo servidor
 * se ele estiver disponivel. Roda depois do primeiro render de proposito, para
 * a tela nunca ficar esperando a rede.
 */
async function iniciarSincronizacao() {
  await Remoto.detectar();
  atualizarIndicadorDados();

  if (Remoto.modo !== 'nuvem') return;

  try {
    Remoto.sincronizando = true;
    await Remoto.carregar();
    renderApp();
    renderProjectInfo();
  } catch (e) {
    console.error('Falha ao carregar da nuvem:', e);
    showToast('Não foi possível carregar da nuvem. Exibindo a última versão salva neste navegador.');
  } finally {
    Remoto.sincronizando = false;
    atualizarIndicadorDados();
  }
}
