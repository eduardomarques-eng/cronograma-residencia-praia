/**
 * Verificação ao vivo da Fase 3: base real → serviço → PDF.
 *
 * Sobe um PostgreSQL embebido, aplica as migrations, semeia o projecto e
 * exercita `listAssignees`, `updateScheduleStageStatus`, o modelo do relatório e
 * `renderScheduleReportPdf`. Existe para apanhar o erro que os testes unitários
 * não apanham: uma coluna trocada ou um `select` que o Prisma não aceita.
 *
 *   npx tsx scripts/verificar-fase3.mjs
 *
 * Nada toca a produção — a base vive numa pasta temporária.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORTA = 55444;
const UTILIZADOR = "fase3";
const SENHA = "fase3-local";
const BASE = "arqvertice_fase3";

const pastaDados = mkdtempSync(join(tmpdir(), "arqvertice-fase3-"));
const url = `postgresql://${UTILIZADOR}:${SENHA}@localhost:${PORTA}/${BASE}`;
const pg = new EmbeddedPostgres({
  databaseDir: pastaDados,
  user: UTILIZADOR,
  password: SENHA,
  port: PORTA,
  persistent: false,
});

let falhas = 0;
function verificar(nome, condicao, detalhe = "") {
  console.log(`${condicao ? "OK   " : "FALHA"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!condicao) falhas += 1;
}

function rodar(comando, args) {
  const r = spawnSync(comando, args, { encoding: "utf8", shell: true });
  if (r.status !== 0) throw new Error(`${comando} ${args.join(" ")}\n${r.stdout}\n${r.stderr}`);
}

const em = (offset) => new Date(Date.now() + offset * 86_400_000);

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(BASE);
  process.env.DATABASE_URL = url;
  process.env.AUTH_SECRET = "fase3-secret-de-teste-com-pelo-menos-32-caracteres";
  process.env.SEED_ADMIN_EMAIL = "admin@fase3.local";
  process.env.SEED_ADMIN_PASSWORD = "senha-fase3-suficientemente-longa";
  process.env.SEED_ADMIN_NAME = "Eduardo Marques";

  rodar("npx.cmd", ["prisma", "migrate", "deploy"]);
  rodar("npx.cmd", ["prisma", "db", "seed"]);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const project = await prisma.project.findFirst({
    orderBy: { createdAt: "asc" },
    include: { client: true },
  });
  if (!project) throw new Error("O seed não criou nenhum projecto.");

  // Etapas com prazos e uma dependência real, como o cronograma de referência.
  await prisma.scheduleStage.deleteMany({ where: { projectId: project.id } });
  const criar = (dados) => prisma.scheduleStage.create({ data: { projectId: project.id, ...dados } });
  await criar({ name: "Estudo Preliminar", discipline: "Arquitetura", designer: "Eduardo Marques", dueDate: em(-30), order: 1, completion: 100, status: "COMPLETED" });
  await criar({ name: "Projeto Executivo", discipline: "Arquitetura", designer: "Eduardo Marques", dueDate: em(40), order: 2, completion: 35, status: "IN_PROGRESS" });
  const formas = await criar({ name: "Projeto Formas Finais", discipline: "Estrutura", designer: "Luan Almeida", dueDate: em(3), order: 3, completion: 60, status: "IN_PROGRESS" });
  await criar({ name: "Projeto Fundação", discipline: "Estrutura", designer: "Luan Almeida", dueDate: em(25), order: 4, completion: 0, status: "NOT_STARTED" });
  const amaduras = await criar({ name: "Projeto Amaduras", discipline: "Estrutura", designer: "Luan Almeida", dueDate: em(60), order: 5, completion: 0, status: "NOT_STARTED", dependencyId: formas.id });

  // ---- Responsáveis: lidos da base, nunca inventados --------------------
  const { listAssignees, updateScheduleStageStatus } = await import("../src/server/services/schedule-service.ts");
  const assignees = await listAssignees(project.id);
  verificar(
    "responsáveis vêm da base, sem nomes inventados",
    assignees.includes("Eduardo Marques") && assignees.includes("Luan Almeida"),
    assignees.join(", "),
  );

  // ---- Autorização antes da regra: nada é escrito sem sessão ----------
  let recusado = false;
  try {
    await updateScheduleStageStatus(amaduras.id, "IN_PROGRESS");
  } catch {
    recusado = true;
  }
  verificar("mudança de estado sem sessão é recusada", recusado);
  const intacta = await prisma.scheduleStage.findUnique({ where: { id: amaduras.id } });
  verificar("etapa recusada não foi alterada", intacta?.status === "NOT_STARTED" && intacta?.completion === 0);

// ---- Relatório e PDF com dados REAIS da base --------------------------
  const { buildScheduleReport } = await import("../src/lib/schedule-report.ts");
  const { renderScheduleReportPdf } = await import("../src/lib/pdf/schedule-report-pdf.ts");
  const { hexString } = await import("../src/lib/pdf/pdf-writer.ts");

  const etapas = await prisma.scheduleStage.findMany({
    where: { projectId: project.id },
    orderBy: { order: "asc" },
    include: { dependency: { select: { name: true, status: true } } },
  });
  const relatorio = buildScheduleReport({
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description,
      scope: project.scope,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      status: project.status,
      address: project.address,
    },
    client: {
      name: project.client.name,
      fullName: project.client.fullName,
      city: project.client.city,
      state: project.client.state,
    },
    stages: etapas.map((s) => ({
      id: s.id,
      name: s.name,
      discipline: s.discipline,
      designer: s.designer,
      startDate: s.startDate,
      endDate: s.endDate,
      dueDate: s.dueDate,
      completion: s.completion,
      status: s.status,
      order: s.order,
      dependencyName: s.dependency?.name ?? null,
      dependencyStatus: s.dependency?.status ?? null,
    })),
    payments: (
      await prisma.payment.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } })
    ).map((p) => ({
      id: p.id,
      name: p.name,
      amount: Number(p.amount),
      dueDate: p.dueDate,
      paidAt: p.paidAt,
      status: p.status,
      stageName: null,
    })),
    budget: project.budget === null ? null : Number(project.budget),
    emittedAt: new Date(),
  });

  verificar("progresso pela regra única", relatorio.overall.progress === 39, `${relatorio.overall.progress}% — (100+35+60+0+0)/5 = 39`);
  verificar(
    "alertas pela regra única",
    relatorio.alerts.dueSoon === 1 && relatorio.alerts.blocked === 1 && relatorio.alerts.overdue === 0,
    `dueSoon=${relatorio.alerts.dueSoon} blocked=${relatorio.alerts.blocked} overdue=${relatorio.alerts.overdue}`,
  );
  verificar(
    "equipe só com responsáveis reais",
    relatorio.equipe.map((p) => p.name).sort().join(", ") === "Eduardo Marques, Luan Almeida",
    relatorio.equipe.map((p) => p.name).join(", "),
  );
  verificar("cliente é o último signatário", relatorio.signatures.at(-1)?.role === "Cliente / Contratante");

  const pdf = Buffer.from(renderScheduleReportPdf(relatorio));
  const destino = join(tmpdir(), "fase3-relatorio.pdf");
  writeFileSync(destino, pdf);
  const texto = pdf.toString("latin1");
  verificar("PDF válido", texto.startsWith("%PDF-1.4") && texto.trimEnd().endsWith("%%EOF"));
  verificar("PDF com conteúdo real", pdf.byteLength > 3000, `${pdf.byteLength} bytes → ${destino}`);
  verificar(
    "PDF leva a obra e a equipa da base",
    texto.includes(hexString("Eduardo Marques")) && texto.includes(hexString("Projeto Formas Finais")),
  );

  // ---- Projecto SEM etapas: o PDF tem de continuar a sair ----------------
  await prisma.scheduleStage.deleteMany({ where: { projectId: project.id } });
  const vazio = buildScheduleReport({
    project: {
      id: project.id,
      name: project.name,
      type: null,
      description: null,
      scope: null,
      startDate: null,
      expectedEndDate: null,
      status: "PLANNING",
      address: null,
    },
    client: { name: project.client.name, fullName: null, city: null, state: null },
    stages: [],
    payments: [],
    budget: null,
    emittedAt: new Date(),
  });
  const pdfVazio = Buffer.from(renderScheduleReportPdf(vazio));
  verificar(
    "PDF sem etapas é gerado na mesma",
    pdfVazio.toString("latin1").startsWith("%PDF-1.4") && pdfVazio.byteLength > 1500,
    `${pdfVazio.byteLength} bytes`,
  );
  verificar(
    "relatório vazio diz que não há dados, em vez de mostrar 0%",
    vazio.empty && vazio.overall.total === 0 && vazio.parecer.join(" ").includes("ainda não tem etapas"),
  );

  await prisma.$disconnect();
} finally {
  await pg.stop();
  rmSync(pastaDados, { recursive: true, force: true });
}

console.log(falhas === 0 ? "\nFASE 3: tudo verificado." : `\nFASE 3: ${falhas} verificação(ões) falharam.`);
process.exitCode = falhas === 0 ? 0 : 1;
