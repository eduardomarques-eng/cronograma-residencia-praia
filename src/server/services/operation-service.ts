import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { stageAlert } from "@/lib/schedule-alerts";
import { completionOf } from "@/lib/progress";
import { requireRole } from "@/server/auth";

/**
 * Operação do cronograma pelo funcionário da equipa (OPERADOR).
 *
 * Lista APENAS os projetos atribuídos ao utilizador via `ProjectAccess` — o
 * mesmo mecanismo que isola o cliente. Um operador nunca vê projetos de outro
 * cliente nem o painel comercial: quem decide o que ele vê é esta consulta,
 * filtrada por `userId`, e não o menu. Reutiliza a regra única de progresso
 * (`completionOf`) e de alertas (`stageAlert`) para não criar uma segunda
 * verdade para o mesmo número.
 */
export async function listOperationProjects(userId: string) {
  const accesses = await prisma.projectAccess.findMany({
    where: { userId },
    select: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          client: { select: { name: true } },
          stages: { select: { completion: true, status: true, dueDate: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  return accesses.map(({ project }) => {
    const overdue = project.stages.filter(
      (stage) => stageAlert({ status: stage.status, dueDate: stage.dueDate }, now).overdue,
    ).length;
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      clientName: project.client.name,
      stages: project.stages.length,
      overdue,
      progress: completionOf(project.stages),
    };
  });
}

/**
 * Gestão da equipa (ADMIN). Todas as funções abaixo exigem sessão de ADMIN — o
 * próprio operador nunca chega aqui, e um cliente muito menos. A atribuição de
 * projetos é a única forma de dar acesso a um operador: escrevemos `ProjectAccess`,
 * o mesmo mecanismo que isola o cliente, e é essa linha que a operação lê.
 */

/** Operadores existentes (funcionários da equipa), para o ADMIN gerir. */
export async function listOperadores() {
  await requireRole("ADMIN");
  return prisma.user.findMany({
    where: { role: "OPERADOR" },
    select: { id: true, name: true, email: true, createdAt: true, projectAccess: { select: { projectId: true } } },
    orderBy: { name: "asc" },
  });
}

/** Projetos disponíveis para atribuir (id + nome + cliente). */
export async function listAssignableProjects() {
  await requireRole("ADMIN");
  return prisma.project.findMany({
    select: { id: true, name: true, client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Define exatamente quais projetos um operador pode operar. Substitui o conjunto
 * (adição e remoção) numa transacção, para que a lista seja a fonte da verdade e
 * não um acrescento sem fim. IDs inválidos são ignorados pela constraint do
 * banco; a unicidade [projectId, userId] impede duplicados.
 */
export async function setOperatorProjectAccess(userId: string, projectIds: readonly string[]) {
  await requireRole("ADMIN");

  const operador = await prisma.user.findFirst({ where: { id: userId, role: "OPERADOR" }, select: { id: true } });
  if (!operador) throw new DomainError("Operador não encontrado.", "NOT_FOUND");

  const uniqueProjectIds = [...new Set(projectIds)];
  const validProjects = await prisma.project.findMany({
    where: { id: { in: uniqueProjectIds } },
    select: { id: true },
  });
  const validIds = validProjects.map((project) => project.id);

  await prisma.$transaction(async (tx) => {
    await tx.projectAccess.deleteMany({ where: { userId } });
    if (validIds.length > 0) {
      await tx.projectAccess.createMany({
        data: validIds.map((projectId) => ({ userId, projectId })),
        skipDuplicates: true,
      });
    }
  });

  return { userId, projectIds: validIds };
}
