import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { notFound } from "@/server/errors";
import { scheduleStageSchema, scheduleStageUpdateSchema } from "@/lib/validation";
import { scheduleStatusFromPercentage } from "@/lib/schedule";

export async function createScheduleStage(input: unknown) {
  const data = scheduleStageSchema.parse(input);
  const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
  if (!project) return notFound("Projeto");
  return prisma.scheduleStage.create({ data: { ...data, status: scheduleStatusFromPercentage(data.completion) } });
}

export async function updateScheduleStage(id: string, input: unknown) {
  const data = scheduleStageUpdateSchema.parse(input);
  const update = data.completion === undefined ? data : { ...data, status: scheduleStatusFromPercentage(data.completion) };
  try {
    return await prisma.scheduleStage.update({ where: { id }, data: update });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Etapa");
    throw error;
  }
}

export async function completeScheduleStage(id: string) {
  return updateScheduleStage(id, { completion: 100, completedAt: new Date() });
}

export async function reorderScheduleStage(id: string, order: number) {
  if (!Number.isInteger(order) || order < 0) throw new Error("A ordem da etapa é inválida.");
  return updateScheduleStage(id, { order });
}

export async function updateScheduleStageStatus(id: string, status: string) {
  if (!["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(status)) throw new Error("Status de etapa inválido.");
  return updateScheduleStage(id, { status });
}
