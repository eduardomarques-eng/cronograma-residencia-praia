/**
 * ============================================================================
 * /api/projeto — ficha tecnica da obra (linha unica)
 *
 *   GET /api/projeto   le      (publico)
 *   PUT /api/projeto   grava   (exige x-chave-admin)
 * ============================================================================
 */
const { query, escritaAutorizada, json } = require('./_db');

// Nome na interface  ->  coluna no banco.
const CAMPOS = {
  nomeObra: 'nome_obra',
  cliente: 'cliente',
  localizacao: 'localizacao',
  loteQuadra: 'lote_quadra',
  zona: 'zona',
  areaConstruida: 'area_construida',
  areaTerreno: 'area_terreno',
  tipologia: 'tipologia',
  dataInicio: 'data_inicio',
  previsaoConclusao: 'previsao_conclusao',
  prazoTotal: 'prazo_total',
  empresa: 'empresa'
};

function paraJSON(linha) {
  const saida = {};
  for (const [chaveJS, coluna] of Object.entries(CAMPOS)) {
    saida[chaveJS] = linha[coluna] ?? '';
  }
  return saida;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const r = await query('SELECT * FROM projeto WHERE id = 1');
      if (!r.rowCount) return json(res, 200, { projeto: null });
      return json(res, 200, { projeto: paraJSON(r.rows[0]) });
    }

    if (req.method === 'PUT') {
      if (!escritaAutorizada(req)) {
        return json(res, 401, { erro: 'Chave de administrador ausente ou invalida' });
      }

      const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

      const colunas = [];
      const valores = [];
      for (const [chaveJS, coluna] of Object.entries(CAMPOS)) {
        if (corpo[chaveJS] === undefined) continue;
        const v = String(corpo[chaveJS]);
        if (v.length > 300) {
          return json(res, 400, { erro: `${chaveJS} passa de 300 caracteres` });
        }
        colunas.push(coluna);
        valores.push(v);
      }

      if (!colunas.length) return json(res, 400, { erro: 'Nenhum campo para atualizar' });

      // UPSERT: se a linha 1 ainda nao existe (base recem-criada), cria.
      const marcadores = colunas.map((_, i) => `$${i + 1}`);
      const atualizacoes = colunas.map(c => `${c} = EXCLUDED.${c}`);
      const r = await query(
        `INSERT INTO projeto (id, ${colunas.join(', ')})
         VALUES (1, ${marcadores.join(', ')})
         ON CONFLICT (id) DO UPDATE SET ${atualizacoes.join(', ')}
         RETURNING *`,
        valores
      );
      return json(res, 200, { projeto: paraJSON(r.rows[0]) });
    }

    res.setHeader('Allow', 'GET, PUT');
    return json(res, 405, { erro: `Metodo ${req.method} nao suportado` });
  } catch (e) {
    console.error('Falha em /api/projeto:', e);
    return json(res, 500, { erro: 'Falha ao acessar o banco de dados' });
  }
};
