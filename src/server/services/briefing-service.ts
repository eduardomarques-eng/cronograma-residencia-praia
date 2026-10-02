import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { briefingSchema, briefingUpdateSchema } from "@/lib/validation";
import { notFound } from "@/server/errors";

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
  return (await prisma.briefing.findUnique({ where: { projectId } })) ?? notFound("Briefing");
}

export async function saveBriefingResponses(projectId: string, input: unknown) {
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
  return prisma.briefing.update({ where: { projectId }, data: { submittedAt: new Date() } });
}
