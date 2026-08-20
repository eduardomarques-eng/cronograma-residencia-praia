/**
 * ============================================================================
 * ACESSO AO POSTGRES + GUARDA DE ESCRITA
 * Compartilhado pelas funcoes serverless em /api.
 * ============================================================================
 */
const { Pool } = require('pg');

/**
 * Em ambiente serverless a funcao "congela" entre invocacoes em vez de morrer.
 * Guardar o pool no escopo global faz a proxima invocacao reaproveitar a
 * conexao; criar um Pool por requisicao esgotaria o limite do banco rapido.
 */
let pool = globalThis.__cronogramaPool;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada');
  }

  pool = new Pool({
    connectionString,
    // Postgres gerenciado (Neon, Supabase, RDS) exige TLS. O certificado nao e
    // verificado porque esses provedores usam CA propria no endpoint pooled.
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000
  });

  pool.on('error', err => console.error('Erro inesperado no pool:', err.message));

  globalThis.__cronogramaPool = pool;
  return pool;
}

async function query(text, params) {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

/**
 * Leitura e publica (o cliente acompanha a obra pelo link).
 * Escrita exige o cabecalho x-chave-admin batendo com ADMIN_KEY.
 *
 * Compara byte a byte em tempo constante para nao vazar o tamanho nem o
 * prefixo da chave por diferenca de tempo de resposta.
 */
function escritaAutorizada(req) {
  const esperado = process.env.ADMIN_KEY;
  if (!esperado) return false;

  const recebido = req.headers['x-chave-admin'];
  if (typeof recebido !== 'string' || recebido.length !== esperado.length) return false;

  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diferenca === 0;
}

/** Converte DD-MM-YYYY (interface) para YYYY-MM-DD (Postgres). */
function paraDataISO(valor) {
  if (typeof valor !== 'string') return null;
  const m = valor.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  // Rejeita 31-02-2026 e afins, que o Date silenciosamente empurraria para marco.
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${dia}`;
}

/** Converte a data vinda do Postgres de volta para DD-MM-YYYY. */
function paraDataBR(valor) {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}-${mes}-${d.getUTCFullYear()}`;
}

function json(res, status, corpo) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(corpo));
}

module.exports = { getPool, query, escritaAutorizada, paraDataISO, paraDataBR, json };
