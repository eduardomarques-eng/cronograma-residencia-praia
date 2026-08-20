/**
 * ============================================================================
 * /api/tarefas — etapas do cronograma
 *
 *   GET    /api/tarefas          lista todas (publico)
 *   POST   /api/tarefas          cria           (exige x-chave-admin)
 *   PUT    /api/tarefas?id=UUID  atualiza       (exige x-chave-admin)
 *   DELETE /api/tarefas?id=UUID  remove         (exige x-chave-admin)
 * ============================================================================
 */
const { query, escritaAutorizada, paraDataISO, paraDataBR, json } = require('./_db');

const DISCIPLINAS = ['Arquitetura', '3D', 'Estrutura', 'Complementares', 'Obras'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function paraJSON(linha) {
  return {
    id: linha.id,
    descricao_etapa: linha.descricao_etapa,
    disciplina_projeto: linha.disciplina_projeto,
    projetista: linha.projetista,
    data_conclusao: paraDataBR(linha.data_conclusao),
    porcentagem: Number(linha.porcentagem),
    ordem: Number(linha.ordem)
  };
}

/**
 * Valida o corpo vindo do navegador. Nada entra no banco sem passar por aqui:
 * a interface pode ser contornada, a API nao.
 */
function validar(corpo, exigirTudo) {
  const erros = [];
  const dados = {};

  if (exigirTudo || corpo.descricao_etapa !== undefined) {
    const d = typeof corpo.descricao_etapa === 'string' ? corpo.descricao_etapa.trim() : '';
    if (!d) erros.push('descricao_etapa e obrigatoria');
    else if (d.length > 255) erros.push('descricao_etapa passa de 255 caracteres');
    else dados.descricao_etapa = d;
  }

  if (exigirTudo || corpo.disciplina_projeto !== undefined) {
    if (!DISCIPLINAS.includes(corpo.disciplina_projeto)) {
      erros.push(`disciplina_projeto deve ser uma de: ${DISCIPLINAS.join(', ')}`);
    } else {
      dados.disciplina_projeto = corpo.disciplina_projeto;
    }
  }

  if (exigirTudo || corpo.projetista !== undefined) {
    const p = typeof corpo.projetista === 'string' ? corpo.projetista.trim() : '';
    if (!p) erros.push('projetista e obrigatorio');
    else if (p.length > 100) erros.push('projetista passa de 100 caracteres');
    else dados.projetista = p;
  }

  if (exigirTudo || corpo.data_conclusao !== undefined) {
    const iso = paraDataISO(corpo.data_conclusao);
    if (!iso) erros.push('data_conclusao deve estar em DD-MM-YYYY e ser uma data valida');
    else dados.data_conclusao = iso;
  }

  if (exigirTudo || corpo.porcentagem !== undefined) {
    const n = Number(corpo.porcentagem);
    if (!Number.isInteger(n) || n < 0 || n > 100) erros.push('porcentagem deve ser inteiro de 0 a 100');
    else dados.porcentagem = n;
  }

  if (corpo.ordem !== undefined) {
    const n = Number(corpo.ordem);
    if (Number.isInteger(n)) dados.ordem = n;
  }

  return { erros, dados };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const r = await query(
        'SELECT id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem, ordem FROM tarefas ORDER BY ordem, data_conclusao'
      );
      return json(res, 200, { tarefas: r.rows.map(paraJSON) });
    }

    // Daqui para baixo, tudo altera dados.
    if (!escritaAutorizada(req)) {
      return json(res, 401, { erro: 'Chave de administrador ausente ou invalida' });
    }

    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'POST') {
      const { erros, dados } = validar(corpo, true);
      if (erros.length) return json(res, 400, { erro: 'Dados invalidos', detalhes: erros });

      const id = UUID_RE.test(corpo.id || '') ? corpo.id : null;

      const r = await query(
        `INSERT INTO tarefas (id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem, ordem)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5::date, $6,
                 COALESCE($7, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM tarefas)))
         RETURNING id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem, ordem`,
        [id, dados.descricao_etapa, dados.disciplina_projeto, dados.projetista,
         dados.data_conclusao, dados.porcentagem, dados.ordem ?? null]
      );
      return json(res, 201, { tarefa: paraJSON(r.rows[0]) });
    }

    const id = req.query?.id;
    if (!UUID_RE.test(id || '')) {
      return json(res, 400, { erro: 'Parametro id (UUID) e obrigatorio' });
    }

    if (req.method === 'PUT') {
      const { erros, dados } = validar(corpo, false);
      if (erros.length) return json(res, 400, { erro: 'Dados invalidos', detalhes: erros });

      const campos = Object.keys(dados);
      if (!campos.length) return json(res, 400, { erro: 'Nenhum campo para atualizar' });

      // Monta o SET so com o que veio, sem concatenar valor nenhum na string SQL.
      const sets = campos.map((c, i) => `${c} = $${i + 2}${c === 'data_conclusao' ? '::date' : ''}`);
      const r = await query(
        `UPDATE tarefas SET ${sets.join(', ')} WHERE id = $1::uuid
         RETURNING id, descricao_etapa, disciplina_projeto, projetista, data_conclusao, porcentagem, ordem`,
        [id, ...campos.map(c => dados[c])]
      );
      if (!r.rowCount) return json(res, 404, { erro: 'Tarefa nao encontrada' });
      return json(res, 200, { tarefa: paraJSON(r.rows[0]) });
    }

    if (req.method === 'DELETE') {
      const r = await query('DELETE FROM tarefas WHERE id = $1::uuid', [id]);
      if (!r.rowCount) return json(res, 404, { erro: 'Tarefa nao encontrada' });
      return json(res, 200, { removida: id });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return json(res, 405, { erro: `Metodo ${req.method} nao suportado` });
  } catch (e) {
    console.error('Falha em /api/tarefas:', e);
    return json(res, 500, { erro: 'Falha ao acessar o banco de dados' });
  }
};
