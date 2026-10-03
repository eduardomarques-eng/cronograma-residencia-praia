import { prisma } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { requireRole } from "@/server/auth";
import { createBriefingToken, hashBriefingToken } from "@/lib/briefing-token";

async function ensureBriefing(projectId: string) {
  const briefing = await prisma.briefing.upsert({
    where: { projectId },
    create: { projectId, responses: {} },
    update: {},
    select: { id: true, projectId: true },
  });
  return briefing;
}

export async function createBriefingLink(projectId: string) {
  await requireRole("ADMIN");
  const briefing = await ensureBriefing(projectId);
  await prisma.briefingAccessLink.updateMany({ where: { briefingId: briefing.id, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = createBriefingToken();
  await prisma.briefingAccessLink.create({ data: { briefingId: briefing.id, tokenHash: hashBriefingToken(token) } });
  return { token, projectId: briefing.projectId };
}

export async function revokeBriefingLink(projectId: string) {
  await requireRole("ADMIN");
  const briefing = await prisma.briefing.findUnique({ where: { projectId }, select: { id: true } });
  if (!briefing) return notFound("Briefing");
  return prisma.briefingAccessLink.updateMany({ where: { briefingId: briefing.id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function getBriefingLinkStatus(projectId: string) {
  await requireRole("ADMIN");
  const briefing = await prisma.briefing.findUnique({
    where: { projectId },
    include: { accessLinks: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!briefing) return { linkStatus: "NOT_STARTED" as const, briefingStatus: "NOT_STARTED" as const, lastAccessAt: null, createdAt: null };
  const link = briefing.accessLinks[0];
  return {
    linkStatus: !link || link.revokedAt ? "REVOKED" as const : "ACTIVE" as const,
    briefingStatus: briefing.status === "FINALIZED" ? "SUBMITTED" as const : Object.keys(briefing.responses as object).length ? "IN_PROGRESS" as const : "NOT_STARTED" as const,
    lastAccessAt: link?.lastAccessAt ?? null,
    createdAt: link?.createdAt ?? null,
  };
}

export async function resolveBriefingToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) throw new DomainError("Link de briefing inválido.", "NOT_FOUND");
  const link = await prisma.briefingAccessLink.findUnique({
    where: { tokenHash: hashBriefingToken(token) },
    include: { briefing: { include: { project: { select: { id: true, name: true, client: { select: { name: true } } } } } } },
  });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) throw new DomainError("Este link de briefing foi revogado, expirou ou não existe.", "NOT_FOUND");
  const now = new Date();
  await prisma.briefingAccessLink.update({
    where: { id: link.id },
    data: { lastAccessAt: now, firstAccessAt: link.firstAccessAt ?? now },
  });
  return link;
}
