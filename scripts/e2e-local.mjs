/**
 * Ambiente E2E local, de ponta a ponta.
 *
 * Os testes de isolamento do portal provam que um cliente NÃO acede ao projeto
 * de outro. Sem base de dados eles ficavam `skipped` — a garantia de segurança
 * central nunca era executada. Este script sobe um PostgreSQL embebido,
 * aplica as migrations, cria as fixtures e corre o Playwright.
 *
 *   node scripts/e2e-local.mjs
 *
 * Nada toca a produção: a base vive numa pasta temporária e é destruída no fim.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORTA = 55432;
const UTILIZADOR = "e2e";
const SENHA = "e2e-local";
const BASE = "arqvertice_e2e";

const pastaDados = mkdtempSync(join(tmpdir(), "arqvertice-e2e-"));
const url = `postgresql://${UTILIZADOR}:${SENHA}@localhost:${PORTA}/${BASE}`;

const PORTA_APP = 3000;

/**
 * O `playwright.config` reutiliza um servidor dev já existente. Se sobrou um de
 * uma execução anterior, os testes correm contra o código ANTIGO eFAIL sem
 * qualquer indicação — foi exactamente o que aconteceu na primeira tentativa
 * (o login continuava a cair em `/`). Por isso limpamos a porta primeiro.
 */
function libertarPorta(porta) {
  const netstat = spawnSync("netstat", ["-ano"], { encoding: "utf8", shell: true }).stdout ?? "";
  for (const linha of netstat.split("\n")) {
    if (!new RegExp(`:${porta}\\s`).test(linha) || !/LISTENING/i.test(linha)) continue;
    const pid = (linha.trim().split(/\s+/).pop() ?? "").trim();
    if (/^\d+$/.test(pid)) spawnSync("taskkill", ["/PID", pid, "/F", "/T"], { stdio: "ignore", shell: true });
  }
}

const correr = (comando, argumentos, ambiente) => {
  const resultado = spawnSync(comando, argumentos, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...ambiente },
  });
  if (resultado.status !== 0) {
    throw new Error(`${comando} ${argumentos.join(" ")} terminou com codigo ${resultado.status}`);
  }
};

const postgres = new EmbeddedPostgres({
  databaseDir: pastaDados,
  user: UTILIZADOR,
  password: SENHA,
  port: PORTA,
  persistent: false,
});

const ambiente = {
  ...process.env,
  DATABASE_URL: url,
  // O `hashPassword` exige um segredo de 32+ caracteres. Este vale apenas para
  // a base temporaria: nunca é usado em produção.
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-local-only-secret-com-32-ou-mais-caracteres",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(BASE);
  console.log(`Postgres embebido em ${url}`);

  correr("npx prisma migrate deploy", [], ambiente);
  console.log("Migrations aplicadas.");

  // A seed de isolamento imprime as variaveis E2E_* que o Playwright le.
  const fixtures = spawnSync("npx tsx e2e/seed-isolation.ts", [], {
    encoding: "utf8",
    shell: true,
    env: ambiente,
  });
  if (fixtures.status !== 0) throw new Error(fixtures.stderr || "seed-isolation falhou");

  const variaveis = {};
  for (const linha of fixtures.stdout.split("\n")) {
    const achado = linha.match(/^(E2E_[A-Z_]+)=(.*)$/);
    if (achado) variaveis[achado[1]] = achado[2].trim();
  }
  console.log(`Fixtures criadas (${Object.keys(variaveis).length} variaveis).`);

  const alvo = process.argv[2] ?? "e2e/briefing-isolation.spec.ts";
  libertarPorta(PORTA_APP);
  // Com vários workers a baterem ao mesmo tempo numa compilação fria do
  // `next dev`, o Chromium aborta pedidos: o `ERR_ABORTED` alterna entre testes
  // a cada execução e não diz nada sobre o produto.
  correr(`npx playwright test ${alvo} --workers=1`, [], { ...ambiente, ...variaveis });
  console.log("E2E verde.");
} finally {
  await postgres.stop().catch(() => {});
  // O PostgreSQL larga os ficheiros de forma assíncrona; falhar aqui não
  // invalida o resultado dos testes.
  try {
    rmSync(pastaDados, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}