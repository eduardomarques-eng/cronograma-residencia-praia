import { prisma } from "@/server/db";
import { requirePageProjectAccess, requireProjectAccess } from "@/server/auth";
import {
  buildScheduleReport,
  type ReportPayment,
  type ReportStage,
  type ScheduleReport,
  type ScheduleReportInput,
} from "@/lib/schedule-report";
import { PdfWriter } from "@/lib/pdf/pdf-writer";

/**
 * SERVIÇO DO RELATÓRIO DE CRONOGRAMA — Fase 3.
 *
 * Uma única leitura da base alimenta TRÊS consumidores: a página do ecrã, o PDF
 * e qualquer exportação futura. Todos recebem o mesmo `ScheduleReport`, portanto
 * o número que o cliente lê na tela é exactamente o número que vai impresso.
 *
 * A autorização é feita aqui (`requireProjectAccess`), nunca no componente: o
 * `projectId` chega do pedido e não prova nada sozinho.
 */

export type ScheduleReportBundle = {
  report: ScheduleReport;
  projectId: string;
  projectName: string;
};

/**
 * Lê o projecto e devolve o relatório pronto a desenhar.
 *
 * `emittedAt` é parâmetro (e não `new Date()` dentro) para que a mesma leitura
 * alimente a página e o PDF com a mesma data de emissão. Sem isso, um relatório
 * impresso logo a seguir à página sairia com datas diferentes.
 */
export async function getScheduleReport(
  projectId: string,
  emittedAt: Date = new Date(),
): Promise<ScheduleReportBundle | null> {
  await requireProjectAccess(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      stages: {
        orderBy: { order: "asc" },
        include: { dependency: { select: { name: true, status: true } } },
      },
      payments: { orderBy: { order: "asc" }, include: { scheduleStage: { select: { name: true } } } },
    },
  });
  if (!project) return null;

  const stages: ReportStage[] = project.stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    discipline: stage.discipline,
    designer: stage.designer,
    startDate: stage.startDate,
    endDate: stage.endDate,
    dueDate: stage.dueDate,
    completion: stage.completion,
    status: stage.status,
    order: stage.order,
    dependencyName: stage.dependency?.name ?? null,
    dependencyStatus: stage.dependency?.status ?? null,
  }));

  const payments: ReportPayment[] = project.payments.map((payment) => ({
    id: payment.id,
    name: payment.name,
    // `amount` chega como Decimal do Prisma; a interface é em number.
    amount: Number(payment.amount),
    dueDate: payment.dueDate,
    paidAt: payment.paidAt,
    status: payment.status,
    stageName: payment.scheduleStage?.name ?? null,
  }));

  const input: ScheduleReportInput = {
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description,
      scope: project.scope,
      startDate: project.startDate,
      expectedEndDate: project.expectedEndDate,
      status: project.status,
      address: (project.address as Record<string, unknown> | null) ?? null,
    },
    client: {
      name: project.client.name,
      fullName: project.client.fullName,
      city: project.client.city,
      state: project.client.state,
    },
    stages,
    payments,
    budget: project.budget === null ? null : Number(project.budget),
    emittedAt,
  };

  return { report: buildScheduleReport(input), projectId: project.id, projectName: project.name };
}

/** Mesma leitura, para uma página que precisa de confirmar o acesso. */
export async function getScheduleReportForPage(
  projectId: string,
  emittedAt: Date = new Date(),
): Promise<ScheduleReportBundle | null> {
  await requirePageProjectAccess(projectId);
  const bundle = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!bundle) return null;
  return getScheduleReport(projectId, emittedAt);
}