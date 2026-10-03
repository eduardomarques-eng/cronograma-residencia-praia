import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const existingClient = await prisma.client.findUnique({ where: { email: "demo@example.com" } });
  const client = existingClient ?? await prisma.client.create({
    data: {
      name: "Cliente de demonstração",
      fullName: "Cliente de demonstração",
      email: "demo@example.com",
      status: "ACTIVE",
      projects: {
        create: {
          name: "Residência modelo",
          type: "Residencial",
          description: "Projeto de demonstração para validação da plataforma.",
          scope: "Estudo preliminar e projeto executivo",
          budget: 120000,
          status: "IN_PROGRESS",
          stages: {
            create: [
              { name: "Arquitetura", order: 1, status: "COMPLETED", completion: 100 },
              { name: "3D", order: 2, status: "IN_PROGRESS", completion: 50 },
              { name: "Estrutura", order: 3, status: "NOT_STARTED" },
            ],
          },
          payments: {
            create: [
              { name: "Entrada", amount: 30000, order: 1, status: "PAID", paidAt: new Date() },
              { name: "Projeto executivo", amount: 50000, order: 2, status: "PENDING" },
              { name: "Entrega final", amount: 40000, order: 3, status: "AWAITING_COMPLETION" },
            ],
          },
          briefing: {
            create: {
              responses: {
                objective: "Casa para família",
                rooms: ["sala", "cozinha"],
              },
            },
          },
        },
      },
    },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const clientPassword = process.env.SEED_CLIENT_PASSWORD;
  if (!adminPassword || !clientPassword) {
    throw new Error("Defina SEED_ADMIN_PASSWORD e SEED_CLIENT_PASSWORD antes de executar o seed.");
  }
  await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com" },
    update: { name: "Administrador", passwordHash: hashPassword(adminPassword), role: "ADMIN" },
    create: {
      name: "Administrador",
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
      passwordHash: hashPassword(adminPassword),
      role: "ADMIN",
    },
  });
  const clientUser = await prisma.user.upsert({
    where: { email: process.env.SEED_CLIENT_EMAIL ?? client.email ?? "cliente@example.com" },
    update: { name: client.name, passwordHash: hashPassword(clientPassword), role: "CLIENT", clientId: client.id },
    create: {
      name: client.name,
      email: process.env.SEED_CLIENT_EMAIL ?? client.email ?? "cliente@example.com",
      passwordHash: hashPassword(clientPassword),
      role: "CLIENT",
      clientId: client.id,
    },
  });
  const project = await prisma.project.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });
  if (project) {
    await prisma.projectAccess.upsert({
      where: { projectId_userId: { projectId: project.id, userId: clientUser.id } },
      update: {},
      create: { projectId: project.id, userId: clientUser.id },
    });
    const report = await prisma.projectReport.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });
    if (report) {
      await prisma.projectReport.update({
        where: { id: report.id },
        data: { title: "Relatório inicial", status: "RELEASED", releasedAt: new Date() },
      });
    } else {
      await prisma.projectReport.create({
        data: { projectId: project.id, title: "Relatório inicial", status: "RELEASED", releasedAt: new Date() },
      });
    }
  }
  console.info(`Seed concluído para o cliente ${client.id}.`);
}

main()
  .catch((error) => {
    console.error("Falha ao executar o seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
