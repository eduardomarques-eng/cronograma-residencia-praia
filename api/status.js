/**
 * ============================================================================
 * /api/status — diagnostico publico
 * Diz se a API subiu, se DATABASE_URL existe, se o banco responde e se o
 * esquema foi aplicado. Nunca devolve a string de conexao nem a chave.
 * ============================================================================
 */
const { query, json } = require('./_db');

module.exports = async function handler(req, res) {
  const diagnostico = {
    api: 'online',
    databaseUrlConfigurada: Boolean(process.env.DATABASE_URL),
    adminKeyConfigurada: Boolean(process.env.ADMIN_KEY),
    banco: 'nao testado',
    esquemaAplicado: false,
    totalTarefas: null
  };

  if (!diagnostico.databaseUrlConfigurada) {
    diagnostico.banco = 'DATABASE_URL ausente';
    return json(res, 200, diagnostico);
  }

  try {
    await query('SELECT 1');
    diagnostico.banco = 'conectado';

    const r = await query(
      "SELECT to_regclass('public.tarefas') IS NOT NULL AS tem_tabela"
    );
    diagnostico.esquemaAplicado = Boolean(r.rows[0]?.tem_tabela);

    if (diagnostico.esquemaAplicado) {
      const c = await query('SELECT COUNT(*)::int AS total FROM tarefas');
      diagnostico.totalTarefas = c.rows[0].total;
    }
  } catch (e) {
    diagnostico.banco = 'falha na conexao';
    // Mensagem curta do driver ajuda a diagnosticar sem expor credencial.
    diagnostico.detalhe = String(e.message).slice(0, 160);
  }

  return json(res, 200, diagnostico);
};
