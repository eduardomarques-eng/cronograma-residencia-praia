import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { buildCommercialTimeline } from "@/lib/commercial-timeline";
import { deriveCommercialInsights } from "@/lib/commercial-insights";
import { SIGNATURE_STATUS_LABELS } from "@/lib/signature";

const SERVICE_LABELS: Record<string, string> = {
  PLANNING: "Aguardando início",
  IN_PROGRESS: "Em execução",
  COMPLETED: "Concluído",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
};

/**
 * Tópicos 28 e 29 — visão comercial do projeto no mesmo contexto do ADMIN:
 * proposta, contrato, assinatura, serviço e linha do tempo.
 */
export async function getProjectCommercialSummary(projectId: string) {
  await requireRole("ADMIN");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, status: true, briefing: { select: { id: true, status: true } } },
  });
  if (!project) return null;

  const proposal = await prisma.proposal.findFirst({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      contract: { include: { signature: true } },
    },
  });

  const proposalEvents = proposal
    ? await prisma.notificationEvent.findMany({
        where: { entityId: proposal.id },
        orderBy: { occurredAt: "asc" },
        select: { type: true, occurredAt: true },
      })
    : [];
  const contractEvents = proposal?.contract
    ? await prisma.notificationEvent.findMany({
        where: { entityId: proposal.contract.id },
        orderBy: { occurredAt: "asc" },
        select: { type: true, occurredAt: true },
      })
    : [];

  const timeline = buildCommercialTimeline({
    briefingExists: Boolean(project.briefing),
    briefingStatus: project.briefing?.status ?? null,
    proposalCreated: Boolean(proposal),
    events: [...proposalEvents, ...contractEvents],
    contractStatus: proposal?.contract?.status ?? null,
    signatureStatus: proposal?.contract?.signature?.status ?? null,
    projectStatus: project.status,
  });

  return {
    proposal: proposal
      ? {
          id: proposal.id,
          status: proposal.status,
          total: Number(proposal.versions[0]?.total ?? 0),
          version: proposal.versions[0]?.version ?? null,
        }
      : null,
    contract: proposal?.contract
      ? { id: proposal.contract.id, status: proposal.contract.status, version: proposal.contract.version }
      : null,
    signature: proposal?.contract?.signature
      ? {
          status: proposal.contract.signature.status,
          label: SIGNATURE_STATUS_LABELS[proposal.contract.signature.status],
          provider: proposal.contract.signature.provider,
        }
      : null,
    service: { status: project.status, label: SERVICE_LABELS[project.status] ?? project.status },
    timeline,
  };
}

/** Tópico 30 — recomendações determinísticas com a origem explicitada. */
export async function getProposalCommercialInsights(proposalId: string) {
  await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { include: { briefing: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      contract: true,
    },
  });
  if (!proposal) return [];
  const version = proposal.versions[0];
  const services = Array.isArray(version?.services) ? (version.services as Array<Record<string, unknown>>) : [];
  const content = (proposal.contract?.content ?? {}) as Record<string, unknown>;
  return deriveCommercialInsights({
    briefingResponses: (proposal.project.briefing?.responses ?? null) as Record<string, unknown> | null,
    services,
    contractScopeReason: typeof content.scopeReason === "string" ? content.scopeReason : null,
    contractScopeMatched: Array.isArray(content.disciplines) ? (content.disciplines as string[]) : [],
  });
}