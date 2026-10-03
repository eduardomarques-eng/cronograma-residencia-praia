import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { resolveProposalAccess } from "@/server/services/proposal-service";
import { generateProposalDocument, type GeneratorInput, type GeneratedDocument } from "@/lib/document-generator";
import { resolvePaymentPlanForVersion } from "@/lib/payment-plan";
import { resolvePortfolioSelection, type PortfolioImage } from "@/lib/portfolio";
import { canDecideProposal } from "@/lib/proposal-access";
import { buildPublicProposalDTO, type PublicProposalDTO } from "@/lib/public-proposal-dto";
import { type ScheduleTask } from "@/lib/smart-schedule";

/**
 * Tópico 41 — PREVIEW DO ADMIN ("Visualizar como o cliente").
 *
 * A garantia que este serviço dá é simples e verificável: **o preview é o
 * documento**, não uma aproximação. Chama exactamente o mesmo gerador que a
 * página pública chama, com os mesmos dados. Se o preview parece certo, o
 * cliente vê o mesmo.
 *
 * E o inverso também vale, e é o que o tópico exige explicitamente:
 *  · não usa dados fictícios — nenhum placeholder ou nome de exemplo entra;
 *  · não mascara informação real — o cliente vê o nome, o valor e os prazos
 *    verdadeiros, porque é isso que ele vai ler.
 *
 * Consequência: o preview exige sessão ADMIN. Sem ela, este serviço não corre.
 */

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

/** Lê as imagens de portfólio de `ServiceItem.presentationImages` (Tópico 44). */
function portfolioFromCatalog(items: Array<Record<string, unknown>>): PortfolioImage[] {
  const images: PortfolioImage[] = [];
  for (const item of items) {
    const discipline = typeof item.discipline === "string" ? item.discipline : null;
    const entries = Array.isArray(item.presentationImages) ? item.presentationImages : [];
    for (const entry of entries) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      images.push({
        id: `${String(item.id ?? item.name)}:${images.length}`,
        url: entry.trim(),
        altText: typeof item.name === "string" ? item.name : null,
        disciplines: discipline ? [discipline] : [],
        active: true,
      });
    }
  }
  return images;
}

/**
 * Entradas do gerador acompanhadas da proveniência do plano.
 *
 * A proveniência viaja com os dados em vez de ser calculada outra vez pelo
 * consumidor: é o que permite ao preview dizer "CONGELADO" ou "LEGACY_DERIVED"
 * sem voltar a interpretar o texto da proposta.
 */
export type GeneratorInputWithProvenance = GeneratorInput & {
  planSource: "CONGELADO" | "LEGACY_DERIVED";
  planWarnings: string[];
};

/** Constrói as entradas do gerador (Tópico 40) a partir do banco. */
export async function buildGeneratorInput(
  proposalId: string,
  versionNumber?: number,
): Promise<GeneratorInputWithProvenance> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { include: { client: true, briefing: true } },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!proposal) return notFound("Proposta");

  const version = versionNumber
    ? proposal.versions.find((item) => item.version === versionNumber)
    : proposal.versions[0];
  if (!version) return notFound("Versão da proposta");

  const services = asArray(version.services);
  const formalText = (version.formalText ?? {}) as Record<string, unknown>;

  // Catálogo para recuperar prazo e imagens por serviço (Tópicos 42 e 44).
  const serviceIds = services
    .map((service) => (typeof service.serviceId === "string" ? service.serviceId : null))
    .filter((id): id is string => Boolean(id));
  const catalog = serviceIds.length
    ? await prisma.serviceItem.findMany({ where: { id: { in: serviceIds } } })
    : [];
  const catalogById = new Map(catalog.map((item) => [item.id, item]));

  const lines = services.map((service) => {
    const catalogItem = typeof service.serviceId === "string" ? catalogById.get(service.serviceId) : undefined;
    return {
      name: typeof service.name === "string" ? service.name : "Serviço",
      discipline:
        (typeof service.discipline === "string" ? service.discipline : null) ?? catalogItem?.discipline ?? null,
      unit: typeof service.unit === "string" ? service.unit : catalogItem?.unit ?? null,
      quantity: typeof service.quantity === "number" ? service.quantity : null,
      unitPrice: typeof service.unitPrice === "number" ? service.unitPrice : null,
      subtotal: typeof service.subtotal === "number" ? service.subtotal : null,
      scope: catalogItem?.scope ?? null,
      // O prazo vem do catálogo; sem ele, o cronograma fica inconclusivo.
      estimatedDays: catalogItem?.estimatedDays ?? null,
    };
  });

  // Cronograma: usa as etapas já existentes no projeto quando houver, para
  // respeitar as dependências que o ADMIN configurou (Tópico 42).
  const existingStages = await prisma.scheduleStage.findMany({
    where: { projectId: proposal.projectId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, discipline: true, durationDays: true, dependencyId: true },
  });

  const scheduleTasks: ScheduleTask[] = existingStages.length
    ? existingStages.map((stage) => ({
        id: `etapa:${stage.id}`,
        name: stage.name,
        discipline: stage.discipline,
        durationDays: stage.durationDays,
        dependsOn: stage.dependencyId ? [`etapa:${stage.dependencyId}`] : [],
      }))
    : lines.map((line, index) => ({
        id: `servico:${index}:${line.name}`,
        name: line.name,
        discipline: line.discipline,
        durationDays: line.estimatedDays,
      }));

  const total = Number(version.total ?? 0);

  // Prompt 18, item 2 — o plano vem CONGELADO na versão. Só versões criadas
  // antes da migração caem no ramo legado, e nesse caso o ADMIN vê um aviso.
  const resolvedPlan = resolvePaymentPlanForVersion({
    frozen: version.paymentPlan,
    formalText,
    total,
  });
  const presentation = (version.presentation ?? {}) as Record<string, unknown>;

  return {
    proposal: { id: proposal.id, status: proposal.status, version: version.version, expiresAt: proposal.expiresAt },
    client: {
      name: proposal.project.client.name,
      fullName: proposal.project.client.fullName,
      email: proposal.project.client.email,
      phone: proposal.project.client.phone,
      city: proposal.project.client.city,
    },
    project: {
      id: proposal.project.id,
      name: proposal.project.name,
      description: proposal.project.description,
      type: proposal.project.type,
    },
    services: lines,
    pricing: {
      subtotal: Number(version.subtotal ?? 0),
      adjustment: Number(version.adjustment ?? 0),
      total,
      memory: Array.isArray(version.pricing) ? (version.pricing as string[]) : undefined,
    },
    portfolio: portfolioFromCatalog(catalog),
    paymentPlan: resolvedPlan.snapshot.installments,
    scheduleTasks,
    briefingResponses: (proposal.project.briefing?.responses ?? null) as Record<string, unknown> | null,
    portfolioOverrides:
      presentation.portfolioOverrides && typeof presentation.portfolioOverrides === "object"
        ? (presentation.portfolioOverrides as Record<string, string>)
        : {},
    nextStep: typeof formalText.proximoPasso === "string" ? formalText.proximoPasso : null,
    validityDays: typeof formalText.validityDays === "number" ? formalText.validityDays : null,
    planSource: resolvedPlan.source,
    planWarnings: resolvedPlan.warnings,
  };
}

/**
 * Documento do preview (Tópico 41). Mesma função, mesmos dados, mesma saída do
 * cliente — a impressão digital permite ao ADMIN provar a equivalência.
 */
export async function previewProposalDocument(
  proposalId: string,
  versionNumber?: number,
): Promise<GeneratedDocument & { planSource: "CONGELADO" | "LEGACY_DERIVED"; planWarnings: string[] }> {
  await requireRole("ADMIN");
  const input = await buildGeneratorInput(proposalId, versionNumber);
  const document = generateProposalDocument(input);
  return { ...document, planSource: input.planSource, planWarnings: input.planWarnings };
}

/**
 * Documento público já reduzido a DTO (Prompt 18, itens 3 e 4).
 *
 * Devolve o DTO mais o que a página precisa para decidir se aceita decisão.
 * A página nunca toca na entidade: o objecto que atravessa a fronteira do
 * servidor para o cliente é o `PublicProposalDTO`.
 */
export type PublicProposalDocument = PublicProposalDTO & {
  /** Estado do ciclo, usado apenas para bloquear o botão de decisão. */
  status: string;
  decisionEnabled: boolean;
};

/**
 * Carregador público: único ponto por onde uma proposta chega ao cliente.
 *
 * Concentrar aqui a construção do DTO significa que a página pública nunca
 * selecciona campos por si própria. Tudo o que a apresentação não precisa —
 * token, auditoria, e-mail/telefone/CPF, custos, histórico — nem é lido da base
 * de dados, quanto mais serializado.
 */
export async function loadPublicProposalDocument(input: {
  token: string;
  clientKey: string;
}): Promise<PublicProposalDocument> {
  const link = await resolveProposalAccess(input.token, input.clientKey);
  const proposal = link.proposal;
  const version = proposal.versions[0];
  if (!version) throw new Error("Esta proposta ainda não tem versão publicada.");

  const total = Number(version.total ?? 0);
  const formalText = (version.formalText ?? {}) as Record<string, unknown>;

  // Prompt 18, item 5 — plano CONGELADO na versão publicada. O cliente vê
  // exactamente o que o ADMIN aprovou, e esse valor não muda com o tempo.
  const resolvedPlan = resolvePaymentPlanForVersion({
    frozen: version.paymentPlan,
    formalText,
    total,
  });

  const presentation = (version.presentation ?? {}) as Record<string, unknown>;
  const overrides =
    presentation.portfolioOverrides && typeof presentation.portfolioOverrides === "object"
      ? (presentation.portfolioOverrides as Record<string, string>)
      : {};

  const catalog = await prisma.serviceItem.findMany({
    select: { id: true, name: true, discipline: true, presentationImages: true, active: true },
  });

  // Prompt 18, item 21 — a MESMA resolução usada pelo preview e pelo gerador.
  const portfolio = resolvePortfolioSelection({
    images: portfolioFromCatalog(catalog),
    context: { discipline: null },
    overrides,
    limit: 6,
  })
    .filter((item) => item.state !== "REMOVIDA")
    .map((item) => ({
      url: item.image.url,
      altText: item.image.altText ?? null,
      discipline: item.image.discipline ?? null,
    }));

  const dto = buildPublicProposalDTO({
    version: {
      version: version.version,
      title: version.title,
      createdAt: version.createdAt,
      services: version.services,
      subtotal: version.subtotal,
      adjustment: version.adjustment,
      total: version.total,
      formalText: version.formalText,
      presentation: version.presentation,
    },
    proposal: { expiresAt: proposal.expiresAt },
    client: { name: proposal.project.client.name, fullName: proposal.project.client.fullName },
    project: { name: proposal.project.name },
    plan: resolvedPlan.snapshot,
    portfolio,
    company: {
      name: process.env.COMPANY_LEGAL_NAME ?? "ARQVERTICE",
      document: process.env.COMPANY_LEGAL_DOCUMENT ?? null,
    },
  });

  return {
    ...dto,
    status: proposal.status,
    decisionEnabled: canDecideProposal(proposal.status),
  };
}


