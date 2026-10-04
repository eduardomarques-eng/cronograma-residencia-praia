/**
 * Fixtures para os testes de isolamento do portal.
 *
 * Sem estas contas, os testes mais importantes da suite — o de que um cliente
 * NAO acede ao projeto de outro, mesmo com o ID certo — ficam `skipped`, ou
 * seja, nunca correm. Este script cria o cenário mínimo para isso acontecer.
 *
 *   npx tsx e2e/seed-isolation.ts
 *
 * Ao fim imprime as variáveis que o Playwright precisa. Apontar para uma base
 * de teste, nunca para produção: o script cria utilizadores reais.
 */
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { createBriefingToken, hashBriefingToken } from "../src/lib/briefing-token";

/**
 * O Prisma só lê `.env`, e este projecto guarda segredos em `.env.local` (é o
 * que o Next.js carrega). Sem este passo o script falha com
 * "Environment variable not found: DATABASE_URL".
 */
if (!process.env.DATABASE_URL) {
  for (const ficheiro of [".env.local", ".env"]) {
    if (!existsSync(ficheiro)) continue;
    for (const linha of readFileSync(ficheiro, "utf8").split("\n")) {
      const achado = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!achado) continue;
      process.env[achado[1]] ??= achado[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const prisma = new PrismaClient();

const SENHA = "SenhaLocalE2E-2026";
const CLIENTE_A = "e2e.cliente.a@arqvertice.test";
const CLIENTE_B = "e2e.cliente.b@arqvertice.test";

async function garantirCliente(email: string, nome: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.clientId) {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: user.clientId } });
    return { client, user };
  }
  const client = await prisma.client.create({
    data: { name: nome, fullName: nome, email, status: "ACTIVE" },
  });
  const criado = await prisma.user.create({
    data: { name: nome, email, passwordHash: hashPassword(SENHA), role: "CLIENT", clientId: client.id },
  });
  return { client, user: criado };
}

async function garantirProjeto(clientId: string, nome: string) {
  const existente = await prisma.project.findFirst({ where: { clientId, name: nome } });
  if (existente) return existente;
  return prisma.project.create({ data: { clientId, name: nome, status: "IN_PROGRESS" } });
}

async function main() {
  const a = await garantirCliente(CLIENTE_A, "Cliente A E2E");
  const b = await garantirCliente(CLIENTE_B, "Cliente B E2E");

  const projetoA = await garantirProjeto(a.client.id, "Residencia E2E A");
  const projetoB = await garantirProjeto(b.client.id, "Residencia E2E B");

  const briefing = await prisma.briefing.upsert({
    where: { projectId: projetoA.id },
    create: { projectId: projetoA.id, responses: {}, status: "DRAFT" },
    update: {},
  });

  // Um token novo por execucao: os links antigos sao revogados para nao
  // acumular, e o Playwright recebe sempre um token valido.
  await prisma.briefingAccessLink.updateMany({
    where: { briefingId: briefing.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const token = createBriefingToken();
  await prisma.briefingAccessLink.create({
    data: { briefingId: briefing.id, tokenHash: hashBriefingToken(token) },
  });

  console.log("E2E_CLIENT_EMAIL=" + CLIENTE_A);
  console.log("E2E_CLIENT_PASSWORD=" + SENHA);
  console.log("E2E_OWN_PROJECT_ID=" + projetoA.id);
  console.log("E2E_FOREIGN_PROJECT_ID=" + projetoB.id);
  console.log("E2E_BRIEFING_TOKEN=" + token);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());