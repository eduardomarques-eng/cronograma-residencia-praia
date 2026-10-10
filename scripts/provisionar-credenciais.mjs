/**
 * Provisionamento e prova de credenciais — ambiente LOCAL e descartável.
 *
 * Sobe um PostgreSQL embutido, aplica as migrations (incluindo a do papel
 * OPERADOR), cria as contas de ADMIN (dono) e OPERADOR (funcionário da equipa)
 * e PROVA que o login funciona com a MESMA função que a aplicação usa
 * (`verifyPassword`). Nada toca a produção: a base vive numa pasta temporária e
 * é destruída no fim.
 *
 * Uso:
 *   node scripts/provisionar-credenciais.mjs
 *
 * As senhas saem do ambiente quando existirem; sem elas, usam-se valores de
 * demonstracaolocais (>=12 caracteres, pela politica de hashPassword).
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORTA = 55499;
const UTILIZADOR = "prov";
const SENHA = "prov-local";
const BASE = "arqvertice_prov";

const AUTH_SECRET = "prov-local-secret-com-32-ou-mais-caracteres!!";
const DATABASE_URL = `postgresql://${UTILIZADOR}:${SENHA}@localhost:${PORTA}/${BASE}`;

// Credenciais de demonstracao para o teste local. O utilizador troca depois.
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "dono@arqvertice.com").trim().toLowerCase();
const ADMIN_SENHA = process.env.SEED_ADMIN_PASSWORD ?? "Dono@2026Arq";
const OPERADOR_EMAIL = (process.env.SEED_OPERADOR_EMAIL ?? "equipe@arqvertice.com").trim().toLowerCase();
const OPERADOR_SENHA = process.env.SEED_OPERADOR_PASSWORD ?? "Equipe@2026Arq";

const pastaDados = mkdtempSync(join(tmpdir(), "arqvertice-prov-"));
const ambiente = {
  ...process.env,
  DATABASE_URL,
  AUTH_SECRET,
  SEED_ADMIN_EMAIL: ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: ADMIN_SENHA,
  SEED_ADMIN_NAME: "Dono do Estudio",
  SEED_OPERADOR_EMAIL: OPERADOR_EMAIL,
  SEED_OPERADOR_PASSWORD: OPERADOR_SENHA,
  SEED_OPERADOR_NAME: "Funcionario da Equipe",
};

const correr = (comando, argumentos) => {
  const r = spawnSync(comando, argumentos, { stdio: "inherit", shell: true, env: ambiente });
  if (r.status !== 0) throw new Error(`${comando} terminou com codigo ${r.status}`);
};

const postgres = new EmbeddedPostgres({ databaseDir: pastaDados, user: UTILIZADOR, password: SENHA, port: PORTA, persistent: false });

try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(BASE);
  console.log(`[prov] Postgres embutido em ${DATABASE_URL}`);

  console.log("[prov] A aplicar migrations...");
  correr("npx prisma migrate deploy", []);
  console.log("[prov] Migrations aplicadas.");

  console.log("[prov] A criar contas (seed)...");
  correr("npm run db:seed", []);

  console.log("[prov] A provar login e papeis...");
  correr("npx tsx scripts/verificar-credenciais.ts", []);

  console.log("\n[prov] SUCESSO — credenciais validas neste ambiente local.");
  console.log("[prov] ADMIN   :", ADMIN_EMAIL, "/", ADMIN_SENHA, "(acesso irrestrito)");
  console.log("[prov] OPERADOR:", OPERADOR_EMAIL, "/", OPERADOR_SENHA, "(acesso restrito ao cronograma)");
} finally {
  await postgres.stop().catch(() => {});
  try { rmSync(pastaDados, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
