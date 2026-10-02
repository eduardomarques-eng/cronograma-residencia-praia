import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { briefingSchema, briefingUpdateSchema } from "@/lib/validation";
import { notFound } from "@/server/errors";
import { requireProjectAccess, requireRole } from "@/server/auth";

function jsonResponses(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function startBriefing(projectId: string) {
  return prisma.briefing.upsert({
    where: { projectId },
    create: { projectId, responses: {} },
    update: {},
  });
}

export async function getBriefing(projectId: string) {
  await requireProjectAccess(projectId);
  return (await prisma.briefing.findUnique({ where: { projectId }, include: { revisions: { orderBy: { version: "desc" } } } })) ?? notFound("Briefing");
}

export async function saveBriefingResponses(projectId: string, input: unknown) {
  await requireProjectAccess(projectId);
  const existing = await prisma.briefing.findUnique({ where: { projectId }, select: { status: true } });
  if (existing?.status === "FINALIZED") throw new Error("Este briefing já foi finalizado e precisa ser reaberto pelo administrador.");
  const data = briefingSchema.omit({ projectId: true }).parse(input);
  const normalizedData = { ...data, responses: jsonResponses(data.responses) };
  return prisma.briefing.upsert({
    where: { projectId },
    create: { projectId, ...normalizedData },
    update: normalizedData,
  });
}

export async function updateBriefing(projectId: string, input: unknown) {
  const data = briefingUpdateSchema.parse(input);
  const { responses, ...rest } = data;
  return prisma.briefing.update({
    where: { projectId },
    data: {
      ...rest,
      ...(responses === undefined ? {} : { responses: jsonResponses(responses) }),
    },
  });
}

export async function finishBriefing(projectId: string) {
  await requireProjectAccess(projectId);
  const briefing = await prisma.briefing.findUnique({ where: { projectId } });
  if (!briefing) return notFound("Briefing");
  if (briefing.status === "FINALIZED") return briefing;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.briefingRevision.create({ data: { briefingId: briefing.id, version: briefing.version, responses: jsonResponses((briefing.responses ?? {}) as Record<string, unknown>) } });
    return tx.briefing.update({ where: { projectId }, data: { submittedAt: now, finalizedAt: now, status: "FINALIZED" } });
  });
}

export async function reopenBriefing(projectId: string) {
  await requireRole("ADMIN");
  return prisma.briefing.update({ where: { projectId }, data: { status: "DRAFT", submittedAt: null, finalizedAt: null, version: { increment: 1 } } });
}

export async function listVisualOptions(questionId?: string) {
  await requireRole("ADMIN");
  return prisma.briefingVisualOption.findMany({ where: questionId ? { questionId } : undefined, orderBy: [{ questionId: "asc" }, { sortOrder: "asc" }] });
}

export async function saveVisualOption(input: {
  id?: string;
  questionId: string;
  value: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
  sortOrder?: number;
  active?: boolean;
}) {
  await requireRole("ADMIN");
  const { id, ...data } = input;
  return id
    ? prisma.briefingVisualOption.update({ where: { id }, data })
    : prisma.briefingVisualOption.create({ data });
}

export async function removeVisualOption(id: string) {
  await requireRole("ADMIN");
  return prisma.briefingVisualOption.delete({ where: { id } });
}
