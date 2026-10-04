import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { projectSchema, projectUpdateSchema } from "@/lib/validation";

export async function createProject(input: unknown) {
  const data = projectSchema.parse(input);
  const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true } });
  if (!client) return notFound("Cliente");
  return prisma.project.create({ data });
}

export async function getProject(id: string) {
  return (await prisma.project.findUnique({
    where: { id },
    include: { client: true, stages: { orderBy: { order: "asc" } }, payments: { orderBy: { order: "asc" } }, briefing: true },
  })) ?? notFound("Projeto");
}

/**
 * Lista com busca real no banco, filtrada no PostgreSQL e não depois de trazida
 * para a memória. A busca cobre o nome do projeto e o nome do cliente, porque
 * é por aí que quem procura um projeto costuma entrar.
 */
export async function listProjects(query?: string) {
  const term = query?.trim();
  return prisma.project.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { client: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { client: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function updateProject(id: string, input: unknown) {
  const data = projectUpdateSchema.parse(input);
  try {
    return await prisma.project.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Projeto");
    throw error;
  }
}

export async function updateProjectStatus(id: string, status: string) {
  const validStatus = projectUpdateSchema.shape.status.safeParse(status);
  if (!validStatus.success) throw new Error("Status de projeto inválido.");
  return updateProject(id, { status: validStatus.data });
}

export async function archiveProject(id: string) {
  return updateProjectStatus(id, "CANCELLED");
}

export async function getProjectSchedule(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { stages: { orderBy: { order: "asc" } } } });
  return project?.stages ?? notFound("Projeto");
}

export async function getProjectPayments(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { payments: { orderBy: { order: "asc" } } } });
  return project?.payments ?? notFound("Projeto");
}
