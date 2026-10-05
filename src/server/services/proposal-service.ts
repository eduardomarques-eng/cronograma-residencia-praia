import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import { diffStudioDecks, type StudioEditOrigin } from "@/lib/studio-audit";
import { AUDIT_ENTITY, type AuditAction } from "@/lib/audit-events";
import { recordNotification } from "@/server/services/notification-service";
import { listActiveContractTemplates, resolveTemplate, messageTemplateExists } from "@/server/services/message-template-service";
import { dispatchWhatsAppMessage } from "@/server/services/whatsapp-service";
import { COMMERCIAL_EVENT, MESSAGE_TEMPLATE_KEY, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from "@/lib/commercial-events";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import {
  canDecideProposalNow,
  canEditProposal,
  canIssueProposalLink,
  enforceProposalRateLimit,
  isProposalExpired,
  isWellFormedProposalToken,
  needsRepublishAfterNewVersion,
  nextStatusAfterNewVersion,
  RateLimitError,
} from "@/lib/proposal-access";
import { freezePaymentPlan, resolvePaymentPlanForVersion } from "@/lib/payment-plan";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { buildContractText, formatCurrencyBRL, formatDateLongBR } from "@/lib/contract-template";
import { sendEmail, escapeHtml } from "@/server/services/email-service";
import { selectContractTemplateForScope } from "@/lib/commercial-scope";
import { computeTotals, itemFromCatalog, normalizeProposalItem, readProposalItems, type ProposalItem } from "@/lib/proposal-item";
import { buildProjectCommercialInput, suggestServices, type ProjectCommercialInput } from "@/lib/project-commercial-input";
import { evaluatePublicationReadiness, type PublicationReadiness } from "@/lib/proposal-readiness";
import {
  assertNoCommercialInvented,
  readStudioDeck,
  toPersistedDeck,
  type CommercialSlots,
} from "@/lib/studio-deck";
import { toCatalogService } from "@/server/services/service-catalog-service";
import { round2, type PricingLevelName } from "@/lib/pricing";
import { clientLinkActor } from "@/server/audit";
import { logError, logInfo } from "@/server/observability";

type ProposalContent = {
  title: string;
  presentation: Record<string, unknown>;
  formalText: Record<string, unknown>;
  services: Array<Record<string, unknown>>;
  subtotal: number;
  adjustment?: number;
  total: number;
  expiresAt?: Date | null;
};

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

type ContractDraft = {
  object: string;
  parties: { client: string; project: string };
  services: Array<Record<string, unknown>>;
  formalText: Record<string, unknown>;
  total: number;
  proposalVersion: number;
  templateId: string;
  templateVersion: number;
  scopeKey: string | null;
  scopeReason: string;
  disciplines: string[];
  text: string;
  missing: string[];
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
};

/** Endereço do CLIENTE guardado como Json; undefined quando não há dados. */
function formatAddress(address: Prisma.JsonValue | null): string | undefined {
  if (!address || typeof address !== "object" || Array.isArray(address)) return undefined;
  const fields = address as Record<string, unknown>;
  const parts = ["logradouro", "numero", "complemento", "bairro", "cidade", "uf", "cep"]
    .map((key) => asString(fields[key]))
    .filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(", ") : undefined;
}

/** Memória de cálculo dos serviços, derivada da versão aprovada. */
function renderServices(services: Array<Record<string, unknown>>): string {
  if (!services.length) return "";
  return services
    .map((service) => {
      const name = asString(service.name) ?? "Serviço";
      const quantity = asString(service.quantity) ?? "1";
      const unit = asString(service.unit) ?? "un.";
      const subtotal = formatCurrencyBRL(Number(service.subtotal ?? 0));
      return `- ${name} (${quantity} ${unit}) — ${subtotal}`;
    })
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* FASE 4C — PROJETO → PROPOSTA                                              */
/* -------------------------------------------------------------------------- */

/**
 * A contagem de ambientes, quando o briefing a informou.
 *
 * Reaproveita a leitura já feita no módulo de input comercial: o editor e o
 * prefill precisam do mesmo número, e recalculá-lo aqui seria um segundo lugar
 * onde essa regra mora — um dos dois acabaria por divergir do outro.
 */
function readEnvironmentsCount(input: ProjectCommercialInput): { quantity: number | null } {
  const evidence = input.evidence.find((entry) => entry.label === "Ambientes informados pelo cliente");
  const parsed = evidence ? Number(evidence.value.replace(/[^0-9]/g, "")) : NaN;
  return { quantity: Number.isFinite(parsed) && parsed > 0 ? parsed : null };
}

/**
 * Número comercial da proposta (item 3).
 *
 * Sequencial por ano, gerado no SERVIDOR. O `code` é identificação, nunca
 * autorização: não aparece no link público nem em qualquer payload do cliente —
 * o único segredo de acesso continua a ser o token.
 *
 * A contagem é feita sobre propostas do ano corrente. Não há colisão possível
 * dentro do mesmo ano porque a proposta nova é sempre criada na mesma
 * transacção que lhe atribui o código.
 */
async function nextProposalCode(tx: Prisma.TransactionClient, now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `PROP-${year}-`;
  const last = await tx.proposal.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNumber = last?.code ? Number(last.code.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, "0")}`;
}

/**
 * Carrega o `PROJECT_COMMERCIAL_INPUT` de um projeto (item 5).
 *
 * Esta é a função que faz a proposta nascer do PROJETO. Ela resolve o cliente e
 * o briefing no servidor — o `projectId` chega do frontend, mas o cliente NUNCA
 * é derivado do que o frontend envia (item 65).
 */
export async function getProjectCommercialInput(projectId: string): Promise<ProjectCommercialInput | null> {
  await requireRole("ADMIN");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, briefing: true },
  });
  if (!project) return null;

  return buildProjectCommercialInput({
    client: {
      id: project.client.id,
      name: project.client.name,
      fullName: project.client.fullName,
      email: project.client.email,
      phone: project.client.phone,
    },
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description,
      scope: project.scope,
      notes: project.notes,
    },
    briefing: project.briefing ? { responses: project.briefing.responses, status: project.briefing.status } : null,
  });
}

/**
 * Sugestões de serviço para a proposta, a partir do catálogo e do projeto.
 *
 * Devolve SUGESTÕES, nunca itens prontos: o ADMIN escolhe o que entra. É o que
 * impede a regra fundamental de ser invertida — "não inventar serviços apenas
 * porque existem no catálogo".
 */
export async function getProposalSuggestions(projectId: string, level: PricingLevelName = "MEDIO") {
  const input = await getProjectCommercialInput(projectId);
  if (!input) return null;

  const catalog = await prisma.serviceItem.findMany({
    where: { active: true },
    orderBy: [{ discipline: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  const services = catalog.map(toCatalogService);

  const { quantity: environmentCount } = readEnvironmentsCount(input);
  return {
    input,
    services,
    suggestions: suggestServices({
      catalog: services,
      project: input.project,
      environmentCount,
      levelPrice: (service) => {
        const record = services.find((item) => item.id === service.id);
        if (!record) return null;
        return level === "BAIXO" ? record.baseLow : level === "MEDIO" ? record.baseMedium : record.baseHigh;
      },
    }),
  };
}

/**
 * A contagem de ambientes, quando o briefing a informou.
 *
 * Reaproveita a leitura já feita no módulo de input comercial: o editor e o
 * prefill precisam do mesmo número, e recalculá-lo aqui seria um segundo lugar
 * onde essa regra mora.
 */
/**
 * FASE 4C — CRIAÇÃO DA PROPOSTA A PARTIR DO PROJETO (itens 5 e 6).
 *
 * Diferença essencial face ao que existia: a proposta deixou de nascer vazia.
 * Antes, `createProposal` criava uma versão com `services: []` e uma capa de
 * texto genérico — exactamente o "formulário comercial vazio" que a regra
 * fundamental proíbe. Agora ela nasce do `PROJECT_COMMERCIAL_INPUT`.
 *
 * O que é importado e o que NÃO é, é a parte que importa:
 *
 *  · cliente, projeto, tipo, área, ambientes, disciplinas, requisitos e
 *    restrições são importados — são fatos que já existem no sistema;
 *  · os SERVIÇOS entram como SUGESTÕES, nunca como linhas contratadas. O item 4
 *    da regra fundamental é literal aqui: não inventamos serviços porque
 *    existem no catálogo.
 *
 * Idempotência: se o projeto já tem proposta, devolvemos a existente em vez de
 * criar uma segunda. Duas propostas para o mesmo projeto significariam duas
 * negociações abertas para o mesmo cliente, e a métrica de valor proposto
 * contaria a mesma oportunidade duas vezes (item 71).
 */
export async function createProposal(projectId: string) {
  const user = await requireRole("ADMIN");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true, briefing: true },
  });
  if (!project) return notFound("Projeto");

  const existing = await prisma.proposal.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (existing) return existing;

  const commercialInput = buildProjectCommercialInput({
    client: {
      id: project.client.id,
      name: project.client.name,
      fullName: project.client.fullName,
      email: project.client.email,
      phone: project.client.phone,
    },
    project: {
      id: project.id,
      name: project.name,
      type: project.type,
      description: project.description,
      scope: project.scope,
      notes: project.notes,
    },
    briefing: project.briefing ? { responses: project.briefing.responses, status: project.briefing.status } : null,
  });

  const { quantity: environmentCount } = readEnvironmentsCount(commercialInput);
  const catalog = await prisma.serviceItem.findMany({
    where: { active: true },
    orderBy: [{ discipline: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  const services = catalog.map(toCatalogService);

  // Sugestões NÃO entram como linhas. Ficam em `presentation.suggestions`,
  // onde o editor as mostra para o ADMIN escolher. Uma linha por sugestão
  // tornaria a proposta "não vazia" sem nada contratado — e a guarda de
  // publicação teria de adivinhar a diferença entre contratado e sugerido.
  const suggestions = suggestServices({
    catalog: services,
    project: commercialInput.project,
    environmentCount,
  });

  const now = new Date();
  const proposal = await prisma.$transaction(async (tx) => {
    const code = await nextProposalCode(tx, now);
    return tx.proposal.create({
      data: {
        projectId,
        code,
        versions: {
          create: {
            version: 1,
            title: `Proposta comercial — ${project.name}`,
            // A capa e o objecto vêm do PROJECTO, não de texto genérico.
            presentation: json({
              slides: [{ type: "cover", title: project.name, body: commercialInput.project.description ?? null }],
              suggestions,
              portfolioOverrides: {},
            }),
            // As condições comerciais que o briefing efectivamente declarou.
            // Não vêm de um modelo de documento: vêm do que o cliente disse.
            formalText: json({
              object: `Prestação de serviços de projeto — ${project.name}`,
              validityDays: DEFAULT_VALIDITY_DAYS,
              conditions: commercialInput.project.restrictions.length
                ? `Condições consideradas: ${commercialInput.project.restrictions.join("; ")}`
                : null,
              premisses: commercialInput.project.requirements,
              included: null,
              excluded: null,
              schedule: null,
              observations: commercialInput.project.notes,
            }),
            services: json([]),
            subtotal: 0,
            total: 0,
            authorId: user.id,
          },
        },
      },
      include: { versions: true },
    });
  });

  await recordAudit({
    action: "PROPOSAL_CREATED",
    entity: "Proposal",
    entityId: proposal.id,
    entityVersion: 1,
    toStatus: "DRAFT",
    actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
    metadata: {
      projectId,
      code: proposal.code,
      // A origem dos dados fica na auditoria: responde "de onde veio este
      // rascunho" sem precisar de reabrir o projeto.
      commercialInput: {
        clientId: commercialInput.client.id,
        briefingStatus: commercialInput.briefingStatus,
        disciplines: commercialInput.project.disciplines,
        environments: commercialInput.project.environments,
        area: commercialInput.project.area,
        evidenceCount: commercialInput.evidence.length,
      },
      suggestions: suggestions.length,
    },
  });

  await recordNotification({
    type: COMMERCIAL_EVENT.PROPOSAL_GENERATED,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `Proposta criada em rascunho para o projeto ${project.name}.`,
    entityType: "Proposal",
    entityId: proposal.id,
    payload: { projectId, code: proposal.code, version: 1, suggestions: suggestions.length },
  });

  return proposal;
}

export async function listProposals() {
  await requireRole("ADMIN");
  return prisma.proposal.findMany({
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } }, versions: { orderBy: { version: "desc" }, take: 1 } },
  });
}

export async function getProposal(id: string) {
  await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true, client: { select: { name: true, phone: true } } } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      contract: { include: { signature: true } },
    },
  });
  if (!proposal) return notFound("Proposta");
  return proposal;
}

/** Validade padrão quando o ADMIN não configura outra (item 34). */
const DEFAULT_VALIDITY_DAYS = 30;

/**
 * FASE 4C — conteúdo que o editor envia para gerar uma NOVA versão.
 *
 * Repare no que NÃO existe aqui: `subtotal` nem `total`. O editor não envia
 * valores calculados. Antes ele fazia `const total = subtotal + adjustment` no
 * React e mandava o resultado para o servidor, que o gravava sem rever nada —
 * o item 19 proíbe exactamente isso ("nunca calcular valores importantes
 * diretamente em componentes React"), e o efeito prático era um cliente poder
 * abrir o formulário, pôr total 0 e submeter uma proposta de R$ 40.000 a zero.
 *
 * Aqui chegam DECISÕES (serviço, quantidade, preço unitário, opcional,
 * desconto) e o servidor calcula os números.
 */
export type ProposalVersionInput = {
  title: string;
  presentation: Record<string, unknown>;
  formalText: Record<string, unknown>;
  lines: Array<{
    serviceId?: string | null;
    name: string;
    discipline?: string | null;
    description?: string | null;
    unit?: string | null;
    quantity: number;
    unitPrice: number;
    optional?: boolean;
    order?: number;
    notes?: string | null;
    scope?: string | null;
    exclusions?: string | null;
    estimatedDays?: number | null;
  }>;
  /**
   * Desconto (negativo) ou acréscimo (positivo), em valor ABSOLUTO.
   *
   * Não é percentual de propósito: um percentual passa a significar outra coisa
   * quando uma linha opcional entra ou sai, e o ADMIN precisa do número que
   * viu antes de confirmar.
   */
  adjustment?: number;
  /** Motivo do ajuste — exigido sempre que houver desconto (item 21). */
  adjustmentReason?: string | null;
  validityDays?: number | null;
  /** Data explícita de expiração escolhida pelo ADMIN. */
  expiresAt?: Date | null;
  /** Plano de pagamento em texto livre ("40% assinatura, ..."). */
  paymentTerms?: string | null;
};

/**
 * FASE 4C — grava uma NOVA versão, calculando tudo no servidor.
 *
 * A regra central desta função (itens 19, 20 e 24): o cliente envia DECISÕES, o
 * servidor devolve NÚMEROS.
 *
 *  · cada subtotal é recalculado por `normalizeProposalItem`;
 *  · o total vem de `computeTotals`, que separa obrigatórios de opcionais;
 *  · o preço unitário escrito pelo ADMIN é REVALIDADO contra o catálogo, e
 *    qualquer linha que não venha do catálogo é marcada como ajuste manual.
 *
 * O preço do catálogo é escolhido aqui, e não vem do `pricingSnapshot` antigo:
 * o snapshot descreve o que foi usado NA VERSÃO ANTERIOR. Reusá-lo faria a
 * próxima versão herdar um preço que o ADMIN já pode ter mudado de propósito.
 */
export async function saveProposalVersion(proposalId: string, input: ProposalVersionInput) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, currentVersion: true, status: true, projectId: true },
  });
  if (!proposal) return notFound("Proposta");
  if (!canEditProposal(proposal.status)) throw new Error("A proposta aprovada está congelada.");

  const version = proposal.currentVersion + 1;
  const catalog = await prisma.serviceItem.findMany({
    where: { active: true },
    orderBy: [{ discipline: "asc" }, { displayOrder: "asc" }],
  });
  const byId = new Map(catalog.map((record) => [record.id, record]));

  /* Preço unitário: o servidor decide se aceita o valor do editor. --------- */
  const items: ProposalItem[] = [];
  const overridden: string[] = [];
  input.lines.forEach((line, index) => {
    const catalogService = line.serviceId ? byId.get(line.serviceId) : undefined;

    if (catalogService) {
      const built = itemFromCatalog(toCatalogService(catalogService), {
        quantity: line.quantity,
        level: "MEDIO",
        unitPriceOverride: line.unitPrice,
        optional: line.optional,
        order: index,
      });
      items.push(
        normalizeProposalItem(
          {
            ...built,
            // O texto do EDITOR só prevalece quando o ADMIN o escreveu; caso
            // contrário mantém-se o do catálogo, que é a fonte de verdade.
            name: line.name.trim() || built.name,
            description: line.description ?? built.description,
            unit: line.unit ?? built.unit,
            scope: line.scope ?? (catalogService.scope ?? null),
            exclusions: line.exclusions ?? (catalogService.exclusions ?? null),
            notes: line.notes ?? (catalogService.notes ?? null),
            estimatedDays: line.estimatedDays ?? catalogService.estimatedDays,
          },
          index,
        ),
      );
      if (built.priceOverridden) overridden.push(built.name);
      return;
    }

    // Serviço livre (não veio do catálogo): aceite, mas MARCADO como ajustado.
    // Uma linha sem `serviceId` é sempre decisão manual do ADMIN, e a memória
    // de cálculo tem de dizer isso.
    const item = normalizeProposalItem({ ...line, level: null, priceOverridden: true }, index);
    items.push(item);
    overridden.push(item.name);
  });

  const adjustment = round2(Number(input.adjustment ?? 0));
  if (adjustment < 0 && !input.adjustmentReason?.trim()) {
    throw new Error("Informe o motivo do desconto: a auditoria comercial exige justificativa.");
  }
  const totals = computeTotals(items, adjustment);

  const formalText = (input.formalText ?? {}) as Record<string, unknown>;
  const validityDays = Number(input.validityDays ?? formalText.validityDays ?? DEFAULT_VALIDITY_DAYS);
  const expiresAt = input.expiresAt ?? null;

  /* Plano de pagamento congelado (itens 31 e 32). --------------------------- */
  // O plano passa aqui de texto livre a dado estruturado. A partir deste
  // momento ADMIN e cliente lêem o MESMO objecto, e a proposta publicada torna-
  // se reproduzível mesmo que o texto seja depois reescrito.
  const formalTextWithPayment: Record<string, unknown> = { ...formalText, validityDays };
  if (input.paymentTerms?.trim()) formalTextWithPayment.formaPagamento = input.paymentTerms.trim();
  const plan = freezePaymentPlan({ formalText: formalTextWithPayment, total: totals.total });

  /* Snapshot do preço (item 24). -------------------------------------------- */
  // É este objecto que sobrevive a alterações de catálogo. Sem ele, mudar o
  // preço de "Projeto de Interiores" amanhã reescreveria o número de uma
  // proposta que o cliente já aprovou — e o contrato nasceria de um valor que
  // ele nunca viu.
  const pricingSnapshot = {
    format: 1,
    capturedAt: new Date().toISOString(),
    level: "MEDIO",
    adjustment: totals.adjustment,
    adjustmentReason: input.adjustmentReason ?? null,
    totals,
    lines: items.map((item) => ({
      serviceId: item.serviceId,
      name: item.name,
      discipline: item.discipline,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      optional: item.optional,
      level: item.level,
      priceOverridden: item.priceOverridden,
      estimatedDays: item.estimatedDays,
    })),
    /** Preço de catálogo no momento do snapshot, para auditar divergências. */
    catalogPrices: items
      .filter((item) => item.serviceId)
      .map((item) => {
        const record = byId.get(item.serviceId!);
        return {
          serviceId: item.serviceId,
          catalogMedium: record ? Number(record.baseMedium) : null,
          catalogLow: record ? Number(record.baseLow) : null,
          catalogHigh: record ? Number(record.baseHigh) : null,
        };
      }),
  };

  /* Estado e revogação (itens 8 e 49). -------------------------------------- */
  // Uma proposta já enviada que recebe nova versão entra em NEGOCIAÇÃO e perde
  // os links antigos: o link anterior apontaria para um documento que o cliente
  // já não vai aprovar. Sem esta revogação, ele aprovaria um rascunho novo sem
  // nunca o ter lido.
  const wasPublished = needsRepublishAfterNewVersion(proposal.status);
  const nextStatus = nextStatusAfterNewVersion(proposal.status);

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.proposalVersion.create({
      data: {
        proposalId,
        version,
        title: input.title.trim() || "Proposta comercial",
        presentation: json(input.presentation),
        formalText: json(formalTextWithPayment),
        services: json(items),
        subtotal: new Prisma.Decimal(totals.contractedSubtotal),
        adjustment: new Prisma.Decimal(adjustment),
        total: new Prisma.Decimal(totals.total),
        paymentPlan: json(plan),
        pricing: json(pricingSnapshot),
        authorId: user.id,
      },
    });
    await tx.proposal.update({
      where: { id: proposalId },
      data: {
        currentVersion: version,
        status: nextStatus,
        expiresAt,
        pricingSnapshot: json(pricingSnapshot),
        // A nova versão ainda não foi publicada: o link passa a exigir
        // republicação e o que estava publicado deixa de ser o vigente.
        ...(wasPublished ? { publishedVersion: null, publishedAt: null } : {}),
      },
    });
    if (wasPublished) {
      await tx.proposalAccessLink.updateMany({
        where: { proposalId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return created;
  });

  await recordAudit({
    action: "PROPOSAL_VERSION_SAVED",
    entity: "ProposalVersion",
    entityId: result.id,
    entityVersion: version,
    fromStatus: proposal.status,
    toStatus: nextStatus,
    actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
    metadata: {
      proposalId,
      version,
      // A memória de cálculo viaja na auditoria: quem audita reconstrói o
      // número sem refazer a conta.
      total: totals.total,
      contractedSubtotal: totals.contractedSubtotal,
      optionalSubtotal: totals.optionalSubtotal,
      adjustment,
      adjustmentReason: input.adjustmentReason ?? null,
      lines: items.length,
      optionalLines: items.filter((item) => item.optional).length,
      priceOverrides: overridden,
      paymentPlanSource: plan.derivedFrom,
      paymentPlanInstallments: plan.installments.length,
      linksRevoked: wasPublished,
    },
  });

  return { version: result, totals, items, readiness: await getProposalReadiness(proposalId) };
}

/**
 * FASE 4C — GRAVAR SÓ A APRESENTAÇÃO (item 9).
 *
 * Editar uma apresentação NÃO cria uma versão nova. A razão é de finances: um
 * novo número de versão diz ao cliente que o orçamento mudou. Reordenar páginas
 * ou corrigir uma legenda não muda um único centavo, e prometer que muda seria
 *MENTIRA.
 *
 * Por isso esta função é deliberadamente estreita:
 *
 *  · actualiza APENAS `presentation` da versão actual;
 *  · nunca toca em `subtotal`, `adjustment`, `total`, `pricing`, `services` ou
 *    `paymentPlan` — o snapshot financeiro é intocável;
 *  · recusa uma proposta aprovada ou congelada, como o resto do sistema;
 *  · passa o deck por `readStudioDeck`, que normaliza e descarta o que não é
 *    recuperável, e por `assertNoCommercialInvented`, que impede que um
 *    `metric` traga um valor inventado pelo editor.
 *
 * O que o ADMIN NÃO consegue é escrever um preço novo a partir do editor
 * visual — e essa recusa é o ponto.
 */
/**
 * A origem declarada da alteração (item 56).
 *
 * O editor diz de onde veio a edição — IA, importação, template — e o servidor
 * regista. A omissão resolve para `MANUAL`, que é o caso maioritário: um
 * `undefined` que sobrasse no registo deixaria a origem em aberto, e "não
 * sabemos de onde veio esta alteração" é a informação mais inútil que um
 * registo de auditoria pode guardar.
 *
 * O valor NÃO é usado para autorizar nada — ver a nota em `saveProposalPresentation`.
 */
function readStudioOrigin(raw: unknown): StudioEditOrigin {
  const declared = (raw as { origin?: unknown } | null)?.origin;
  const value = typeof declared === "string" ? declared.toUpperCase() : "";
  const known: readonly StudioEditOrigin[] = ["MANUAL", "IA", "IMPORTACAO", "TEMPLATE", "REMIX", "APRESENTACAO_BASE"];
  return known.find((entry) => entry === value) ?? "MANUAL";
}

export async function saveProposalPresentation(
  proposalId: string,
  raw: unknown,
): Promise<{ version: number; slides: number }> {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, currentVersion: true, status: true },
  });
  if (!proposal) return notFound("Proposta");
  if (!canEditProposal(proposal.status)) throw new Error("A proposta aprovada está congelada.");

  const deck = readStudioDeck(raw);
  // Uma apresentação sem páginas não é uma apresentação: gravar uma vazia
  // apagaria o que o cliente já viu.
  if (deck.slides.length === 0) {
    throw new Error("A apresentação tem de ter pelo menos uma página.");
  }
  // Traz os números que a proposta REAL tem, para que nenhum destaque possa
  // exibir um valor que o cliente não contratou.
  assertNoCommercialInvented(deck, commercialSlotsOf(await getProposal(proposalId)));

  /*
    FASE 4E — AUDITORIA (item 56).

    O deck anterior é lido ANTES da escrita, porque depois já não há como saber
    o que mudou. O diff puro devolve os eventos concretos — página criada,
    removida, duplicada, layout alterado, tema alterado, imagem substituída,
    edição por IA — em vez de um único "apresentação guardada" que não responde
    a nenhuma pergunta útil numa revisão.

    A origem (IA, importação, template) é DECLARADA pelo editor, e isso é
    seguro porque nada de segurança depende dela: quem grava, se a proposta
    está congelada e que valores comerciais são legítimos são todos decididos
    aqui, no servidor. Confiar numa etiqueta não abre porta nenhuma; recusar a
    edição por não confiar nela tornaria o editor inútil.
  */
  const previous = await prisma.proposalVersion.findUnique({
    where: { proposalId_version: { proposalId, version: proposal.currentVersion } },
    select: { presentation: true },
  });
  const previousDeck = readStudioDeck(previous?.presentation ?? null);
  const origin = readStudioOrigin(raw);
  const events = diffStudioDecks(previousDeck, deck, origin);

  const updated = await prisma.proposalVersion.update({
    where: { proposalId_version: { proposalId, version: proposal.currentVersion } },
    data: { presentation: toPersistedDeck(deck) as Prisma.InputJsonValue },
    select: { version: true },
  });

  /*
    Um evento por entrada. Uma gravação que adiciona três páginas e muda o tema
    tem de deixar três ocorrências, e não uma — é a contagem que responde
    "quantas páginas foram criadas nesta sessão".
  */
  for (const event of events) {
    await recordAudit({
      action: event.action as AuditAction,
      entity: AUDIT_ENTITY.STUDIO_DECK,
      entityId: `${proposalId}:${updated.version}`,
      entityVersion: updated.version,
      fromStatus: proposal.status,
      toStatus: proposal.status,
      actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
      metadata: {
        proposalId,
        version: updated.version,
        origin,
        summary: event.summary,
        ...event.refs,
        // Regista explicitamente que o dinheiro não mudou: é a informação que um
        // revisor vai procurar primeiro.
        totalsTouched: false,
      },
    });
  }

  return { version: updated.version, slides: deck.slides.length };
}

/**
 * Os rótulos->valores que a proposta REAL autoriza a mostrar.
 *
 * As chaves são os rótulos que o `assertNoCommercialInvented` compara com o
 * rótulo do destaque. Por isso são nomes legíveis ("Investimento total") e não
 * nomes de coluna — o mecanismo liga pelo que o utilizador lê na página.
 */
function commercialSlotsOf(resolved: Awaited<ReturnType<typeof getProposal>>): CommercialSlots {
  const version = resolved.versions[0];
  if (!version) return {};
  const money = (value: unknown) => formatCurrencyBRL(Number(value ?? 0));
  return {
    "investimento total": money(version.total),
    subtotal: money(version.subtotal),
    ajuste: money(version.adjustment),
  };
}

/**
 * FASE 4C — a guarda de publicação aplicada ao estado REAL da proposta (item 64).
 *
 * O editor mostra o mesmo resultado que o servidor vai aplicar no momento do
 * envio. Se os dois usassem avaliações diferentes, o ADMIN veria "tudo certo" e
 * o servidor recusaria — e essa diferença seria sempre um bug difícil de ver.
 */
export async function getProposalReadiness(proposalId: string): Promise<PublicationReadiness> {
  await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { select: { id: true, name: true, client: { select: { id: true, name: true, fullName: true } } } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!proposal) return notFound("Proposta");

  const version = proposal.versions[0];
  const formalText = (version?.formalText ?? {}) as Record<string, unknown>;
  const items = readProposalItems(version?.services);
  const total = Number(version?.total ?? 0);
  const validityDays = typeof formalText.validityDays === "number" ? formalText.validityDays : null;

  return evaluatePublicationReadiness({
    client: proposal.project.client,
    project: proposal.project,
    title: version?.title ?? "",
    items,
    total,
    validityDays,
    expiresAt: proposal.expiresAt,
    frozenPaymentPlan: version?.paymentPlan,
    messageTemplateReady: await messageTemplateExists(MESSAGE_TEMPLATE_KEY.PROPOSAL_WHATSAPP),
    now: new Date(),
  });
}

/**
 * FASE 4C — PUBLICAÇÃO (itens 41, 42, 45 e 64).
 *
 * Publicar faz três coisas de uma vez, e as três importam:
 *
 *  1. **Passa pela guarda.** Sem serviço, sem valor, com plano inconsistente,
 *     expirada ou sem template, o link não é emitido. O erro devolve a LISTA do
 *     que falta, para o ADMIN corrigir em vez de adivinhar.
 *  2. **Fixa a versão no link.** `ProposalAccessLink.versionNumber` recebe a
 *     versão publicada. É isto que torna a garantia do item 45 verdadeira: o
 *     link passa a ser uma fotografia do que foi enviado, e não um "última
 *     versão" que muda de conteúdo quando o ADMIN edita.
 *  3. **Revoga os links anteriores.** Só pode haver um link vivo por proposta;
 *     caso contrário, um link antigo continuaria a levar o cliente a uma versão
 *     que já não é a vigente.
 */
export async function createProposalLink(proposalId: string) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, expiresAt: true, status: true, currentVersion: true, code: true },
  });
  if (!proposal) return notFound("Proposta");
  // Tópico 35 — emitir link para uma proposta já aprovada, expirada ou cancelada
  // reabriria um ciclo comercial encerrado.
  if (!canIssueProposalLink(proposal.status)) {
    throw new Error("Não é possível gerar link para uma proposta encerrada.");
  }

  const readiness = await getProposalReadiness(proposalId);
  if (!readiness.ready) {
    const blockers = readiness.issues.filter((issue) => issue.level === "BLOCKER");
    throw new Error(`A proposta não pode ser enviada ainda: ${blockers.map((issue) => issue.message).join(" ")}`);
  }

  await prisma.proposalAccessLink.updateMany({ where: { proposalId, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = createProposalToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.proposalAccessLink.create({
      data: {
        proposalId,
        tokenHash: hashProposalToken(token),
        expiresAt: proposal.expiresAt,
        // A versão publicada. O link passa a ser uma fotografia.
        versionNumber: proposal.currentVersion,
      },
    }),
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: "SENT",
        sentAt: now,
        publishedVersion: proposal.currentVersion,
        publishedAt: now,
      },
    }),
  ]);
  await recordAudit({
    action: "PROPOSAL_SENT",
    entity: "Proposal",
    entityId: proposalId,
    entityVersion: proposal.currentVersion,
    fromStatus: proposal.status,
    toStatus: "SENT",
    actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
    metadata: {
      code: proposal.code,
      // A versão publicada fica na auditoria: responde "qual documento o cliente
      // recebeu" sem depender do estado actual, que pode ter mudado depois.
      publishedVersion: proposal.currentVersion,
      expiresAt: proposal.expiresAt?.toISOString() ?? null,
      warnings: readiness.issues.filter((issue) => issue.level === "WARNING").map((issue) => issue.code),
    },
  });
  await recordNotification({
    type: COMMERCIAL_EVENT.PROPOSAL_SENT,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `Link seguro da proposta ${proposal.code ?? ""} (v${proposal.currentVersion}) gerado e enviado.`.trim(),
    entityType: "Proposal",
    entityId: proposalId,
    payload: { version: proposal.currentVersion },
  });
  return { token, version: proposal.currentVersion, warnings: readiness.issues.filter((issue) => issue.level === "WARNING") };
}

/**
 * Tópico 35 — resolve o link público e devolve a proposta SEM registrar
 * visualização.
 *
 * A separação é deliberada: `decideProposal` precisa validar o token, mas não
 * pode marcar a proposta como "visualizada" como efeito colateral de uma
 * aprovação. Antes, a decisão passava por esta função e inflava as métricas.
 *
 * Tópico 35 — o limite por origem é obrigatório aqui. Anteriormente a função
 * aceitava omitir a origem e a aprovação do cliente ficava sem qualquer
 * restrição.
 */
/* -------------------------------------------------------------------------- */
/* FASE 4C — LEITURA PÚBLICA                                                 */
/* -------------------------------------------------------------------------- */

/**
 * O que `resolveProposalAccess` devolve.
 *
 * A forma é declarada explicitamente porque o objecto é montado em DOIS
 * passos (link primeiro, versão publicada depois) e o TypeScript não consegue
 * inferir a composição sem uma anotação. Declarar o tipo aqui é mais barato do
 * que manter o contrato implícito e descobri-lo num erro de produção.
 */
export type ResolvedProposalAccess = {
  id: string;
  proposalId: string;
  revokedAt: Date | null;
  expiresAt: Date | null;
  /**
   * A versão PUBLICADA.
   *
   * O tipo permite `null` porque o dado vem do banco, onde a coluna é anulável
   * (links criados antes desta fase). A FUNÇÃO já garante que nunca chega aqui
   * um `null`: sem versão, o acesso é recusado antes do retorno. O tipo honesto
   * evita um `as` que esconderia essa garantia.
   */
  versionNumber: number | null;
  firstAccessAt: Date | null;
  proposal: {
    id: string;
    status: string;
    expiresAt: Date | null;
    sentAt: Date | null;
    viewedAt: Date | null;
    currentVersion: number;
    project: {
      id: string;
      name: string;
      client: { id: string; name: string; fullName: string | null; email: string | null; phone: string | null };
    };
    /** Array com exactamente a versão publicada. */
    versions: Array<{
      id: string;
      proposalId: string;
      version: number;
      title: string;
      presentation: Prisma.JsonValue;
      formalText: Prisma.JsonValue;
      services: Prisma.JsonValue;
      subtotal: Prisma.Decimal;
      adjustment: Prisma.Decimal;
      total: Prisma.Decimal;
      pricing: Prisma.JsonValue;
      paymentPlan: Prisma.JsonValue | null;
      frozenAt: Date | null;
      createdAt: Date;
      authorId: string | null;
    }>;
  };
};

export async function resolveProposalAccess(token: string, clientKey: string): Promise<ResolvedProposalAccess> {
  if (!isWellFormedProposalToken(token)) throw new Error("Link de proposta inválido.");
  enforceProposalRateLimit("view", clientKey);

  // Passo 1 — o link, sozinho.
  //
  // A versão publicada é uma propriedade do LINK, e o link só existe depois desta
  // consulta. Tentar filtrar as versões pelo valor dela dentro do mesmo `include`
  // seria pedir ao banco uma condição que ainda não se conhece: o resultado
  // seria a última versão, que é exactamente o bug que estamos a corrigir.
  const base = await prisma.proposalAccessLink.findUnique({
    where: { tokenHash: hashProposalToken(token) },
    select: {
      id: true,
      proposalId: true,
      revokedAt: true,
      expiresAt: true,
      versionNumber: true,
      firstAccessAt: true,
      proposal: { select: { expiresAt: true } },
    },
  });
  if (!base || base.revokedAt || (base.expiresAt && base.expiresAt <= new Date())) {
    // Tópico 35 — tentativa negada fica registrada; o banco não guarda o token,
    // apenas o hash, então registramos a origem e nunca o segredo.
    await recordAudit("PROPOSAL_ACCESS_DENIED", "Proposal", base?.proposalId, undefined, {
      reason: base ? "revoked_or_expired" : "unknown_token",
      clientKey,
    });
    logInfo("proposal_access_denied", { reason: base ? "revoked_or_expired" : "unknown_token", clientKey });
    throw new Error("Este link de proposta expirou ou foi revogado.");
  }

  // FASE 4C, item 42 — link sem versão fixada é um link INCOMPLETO, não um link
  // para "a versão mais recente". Recusar é o comportamento seguro: publicar uma
  // versão que ninguém revisou seria pior do que recusar a leitura.
  if (!base.versionNumber) {
    await recordAudit("PROPOSAL_ACCESS_DENIED", "Proposal", base.proposalId, undefined, {
      reason: "no_published_version",
      clientKey,
    });
    logInfo("proposal_access_denied", { reason: "no_published_version", clientKey });
    throw new Error("Este link de proposta expirou ou foi revogado.");
  }

  // A validade da PROPOSTA também é impeditiva: um link cujo `expiresAt` ficou em
  // aberto mas cuja proposta expirou não pode levar o cliente a aprovar.
  if (isProposalExpired({ expiresAt: base.proposal.expiresAt, now: new Date() })) {
    await recordAudit("PROPOSAL_ACCESS_DENIED", "Proposal", base.proposalId, undefined, {
      reason: "proposal_expired",
      clientKey,
    });
    throw new Error("Este link de proposta expirou ou foi revogado.");
  }

  // Passo 2 — a proposta com a VERSÃO PUBLICADA.
  //
  // Este é o ponto que garante o item 45: o link público mostra o documento que
  // o cliente recebeu, não o último rascunho. Se o ADMIN editar a proposta, o
  // cliente continua a ler exactamente o que foi publicado; para ver a
  // alteração, precisa de um novo link.
  const [proposal, publishedVersion] = await Promise.all([
    prisma.proposal.findUnique({
      where: { id: base.proposalId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        sentAt: true,
        viewedAt: true,
        currentVersion: true,
        project: { select: { id: true, name: true, client: true } },
      },
    }),
    prisma.proposalVersion.findFirst({
      where: { proposalId: base.proposalId, version: base.versionNumber },
    }),
  ]);
  if (!proposal || !publishedVersion) {
    await recordAudit("PROPOSAL_ACCESS_DENIED", "Proposal", base.proposalId, undefined, {
      reason: "published_version_missing",
      clientKey,
    });
    throw new Error("Este link de proposta expirou ou foi revogado.");
  }

  return {
    ...base,
    // `versions[0]` mantém a forma que os consumidores já esperam, mas
    // garantidamente contém a versão PUBLICADA.
    proposal: { ...proposal, versions: [publishedVersion] },
  };
}

export async function resolveProposalToken(token: string, clientKey: string) {
  const link = await resolveProposalAccess(token, clientKey);
  const now = new Date();
  const [, viewed] = await prisma.$transaction([
    prisma.proposalAccessLink.update({
      where: { id: link.id },
      // `firstAccessAt` só é escrito na PRIMEIRA visita: o campo responde
      // "quando o cliente abriu", não "qual foi o último refresh".
      data: { firstAccessAt: link.firstAccessAt ?? now, lastAccessAt: now },
    }),
    // `NEGOTIATING` entra na lista: uma proposta em negociação que o cliente
    // reabriu continua sendo "visualizada", e sem isto a métrica de
    // visualização subestimaria as reaberturas (itens 70 e 71).
    prisma.proposal.updateMany({
      where: { id: link.proposalId, status: { in: ["SENT", "GENERATED", "NEGOTIATING"] } },
      data: { status: "VIEWED", viewedAt: now },
    }),
  ]);
  if (viewed.count > 0) {
    await recordNotification({
      type: COMMERCIAL_EVENT.PROPOSAL_VIEWED,
      channel: NOTIFICATION_CHANNEL.INTERNAL,
      status: NOTIFICATION_STATUS.RECORDED,
      body: "Proposta visualizada pelo cliente.",
      entityType: "Proposal",
      entityId: link.proposalId,
      payload: { viewedAt: now.toISOString(), version: link.versionNumber },
    });
  }
  // Devolve um estado coerente com o banco após registrar a visualização.
  return viewed.count > 0 ? { ...link.proposal, status: "VIEWED" as const, viewedAt: now } : link.proposal;
}

export async function decideProposal(token: string, decision: "APPROVED" | "REJECTED", metadata?: Record<string, unknown>, clientKey = "unknown") {
  // Tópico 35 — a decisão é a operação mais sensível do link público: valida o
  // token sem registrar visualização e aplica o limite mais apertado.
  let link;
  try {
    link = await resolveProposalAccess(token, clientKey);
  } catch (error) {
    logError("proposal_decide_failed", error, { clientKey, decision });
    throw error;
  }
  enforceProposalRateLimit("decide", clientKey);

  const proposal = link.proposal;
  if (proposal.status === "APPROVED" || proposal.status === "REJECTED") return proposal;
  // Tópico 34 — só se decide sobre uma proposta efetivamente enviada. Um
  // rascunho nunca chega ao cliente, portanto aprová-lo seria um estado inválido.
  //
  // FASE 4C, item 34 — a decisão é sobre a versão PUBLICADA. O `link.versions[0]`
  // já é a versão que o cliente viu (ver `resolveProposalAccess`), e é essa que
  // fica congelada. Congelar a `currentVersion` em vez disso congelaria um
  // rascunho que o cliente nunca leu — e o contrato nasceria desse rascunho.
  const approvedVersion = proposal.versions[0]?.version ?? proposal.currentVersion;

  // FASE 4C, item 34 — proposta expirada NÃO é aprovável. A validade é uma
  // condição impeditiva: o cliente não pode aceitar um documento que já não vale.
  if (isProposalExpired({ expiresAt: proposal.expiresAt, now: new Date() })) {
    await recordAudit("PROPOSAL_DECISION_BLOCKED", "Proposal", proposal.id, undefined, {
      status: proposal.status,
      decision,
      reason: "proposal_expired",
      clientKey,
    });
    throw new Error("Esta proposta expirou e não pode mais ser decidida.");
  }

  if (!canDecideProposalNow({ status: proposal.status, expiresAt: proposal.expiresAt, now: new Date() })) {
    await recordAudit("PROPOSAL_DECISION_BLOCKED", "Proposal", proposal.id, undefined, {
      status: proposal.status,
      decision,
      clientKey,
    });
    throw new Error("Esta proposta não está disponível para decisão.");
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    // Tópico 23: ao aprovar, congela a versão apresentada ao cliente para
    // impedir alteração silenciosa e registra qual versão foi aprovada.
    if (decision === "APPROVED") {
      await tx.proposalVersion.updateMany({
        where: { proposalId: proposal.id, version: approvedVersion, frozenAt: null },
        data: { frozenAt: now },
      });
    }

    // Prompt 18, item 39 — O EVENTO DE DOMÍNIO É PARTE DA TRANSAÇÃO.
    //
    // Aprovar + congelar + registrar o evento têm de ser tudo-ou-nada: um
    // "proposal.approved" sem a aprovação correspondente (ou o inverso) deixa a
    // linha do tempo comercial a mentir. Por isso o evento vai para dentro.
    //
    // Já a AUDITORIA (`recordAudit`) fica de fora de propósito: ela nunca lança
    // e existe justamente para não poder reverter uma decisão de negócio. Essa
    // separação é deliberada e está documentada em `src/server/audit.ts`.
    await tx.notificationEvent.create({
      data: {
        type: decision === "APPROVED" ? COMMERCIAL_EVENT.PROPOSAL_APPROVED : COMMERCIAL_EVENT.PROPOSAL_REJECTED,
        channel: NOTIFICATION_CHANNEL.INTERNAL,
        status: NOTIFICATION_STATUS.RECORDED,
        body:
          decision === "APPROVED"
            ? `Proposta versão ${approvedVersion} aprovada e versão congelada.`
            : `Proposta versão ${approvedVersion} recusada.`,
        entityType: "Proposal",
        entityId: proposal.id,
        payload: json({
          ...metadata,
          version: approvedVersion,
          decidedAt: now.toISOString(),
          frozen: decision === "APPROVED",
        }),
      },
    });

    return tx.proposal.update({
      where: { id: proposal.id },
      data: decision === "APPROVED"
        ? {
            status: "APPROVED",
            approvedAt: now,
            // A VERSÃO APROVADA é a publicada, não a `currentVersion`.
            approvedVersion,
            approvalIp: typeof metadata?.ip === "string" ? metadata.ip : null,
            approvalMeta: metadata ? json(metadata) : undefined,
          }
        : {
            status: "REJECTED",
            rejectedAt: now,
            // A rejeição também fica presa à versão que o cliente recusou: sem
            // isto, um "não" a uma proposta cara seria indistinguível de um "não"
            // a uma versão posterior mais barata.
            approvedVersion,
          },
      include: { project: { include: { client: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
  });
  await recordAudit({
    action: `PROPOSAL_${decision}`,
    entity: "Proposal",
    entityId: proposal.id,
    entityVersion: approvedVersion,
    fromStatus: proposal.status,
    toStatus: decision === "APPROVED" ? "APPROVED" : "REJECTED",
    actor: clientLinkActor(),
    metadata: { ...metadata, version: approvedVersion, frozen: decision === "APPROVED" },
  });
  return updated;
}
export async function sendProposalWhatsApp(proposalId: string) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { include: { client: { select: { name: true, fullName: true, phone: true } } } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!proposal) return notFound("Proposta");
  // Tópico 35/34 — regra única de emitibilidade partilhada com createProposalLink.
  if (!canIssueProposalLink(proposal.status)) throw new Error("A proposta já está aprovada e congelada.");


  // 1. Valida o telefone do cadastro oficial do CLIENTE.
  const phone = normalizeWhatsAppPhone(proposal.project.client.phone);
  if (!phone) throw new Error("Cadastre o WhatsApp do cliente antes de enviar a proposta.");

  // 2. Valida/gera o link. O banco guarda só o hash do token, então cada
  //    reenvio gera um link novo e revoga o anterior.
  const { token } = await createProposalLink(proposalId);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const publicLink = `${baseUrl}/briefing-proposta/${token}`;

  // A versão publicada e a validade vêm da MESMA versão que o link expõe.
  const version = proposal.versions[0];
  const formalText = (version?.formalText ?? {}) as { validityDays?: number };
  const validityDays =
    typeof formalText.validityDays === "number" && formalText.validityDays > 0 ? formalText.validityDays : 30;

  // 3. Monta a mensagem a partir do template editável pelo ADMIN.
  //
  // Prompt 19, item 5: passa pelo serviço central. Antes, este serviço lia o
  // template e renderizava sozinho; agora pede o texto já validado, para que
  // inexistente / inativo / variável em falta sejam tratados uniformemente.
  const resolved = await resolveTemplate("proposal.whatsapp", {
    CLIENTE: proposal.project.client.fullName ?? proposal.project.client.name,
    PROJETO: proposal.project.name,
    PROPOSTA: version?.title ?? "Proposta comercial",
    VALOR: formatCurrencyBRL(Number(version?.total ?? 0)),
    VALIDADE: `${validityDays} dias`,
    LINK: publicLink,
  });
  // O serviço central já distinguiu inexistente / inativo / variável ausente e
  // devolveu a razão. O ADMIN recebe a mensagem que diz o que corrigir.
  if (!resolved.ok) throw new Error(resolved.message);

  // 4. Envia pela camada de integração e 5. registra o resultado.
  const dispatch = await dispatchWhatsAppMessage(phone, resolved.text);
  await recordNotification({
    type: COMMERCIAL_EVENT.MESSAGE_SENT,
    channel: NOTIFICATION_CHANNEL.WHATSAPP,
    status: dispatch.status === "SENT" ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.SKIPPED,
    body: resolved.text,
    templateKey: resolved.key,
    recipient: phone,
    entityType: "Proposal",
    entityId: proposalId,
    payload: {
      provider: dispatch.provider,
      externalId: dispatch.externalId ?? null,
      link: publicLink,
      templateVersion: resolved.version,
    },
  });
  await recordAudit("PROPOSAL_WHATSAPP_READY", "Proposal", proposalId, user.id, {
    phone,
    provider: dispatch.provider,
  });
  return {
    phone,
    message: resolved.text,
    url: dispatch.deepLink ?? null,
    provider: dispatch.provider,
    link: publicLink,
  };
}

/**
 * FASE 4C — dados para o PDF da proposta formal (item 58).
 *
 * Devolve a entrada EXACTA que `generateProposalPdf` consome, sem o cliente:
 * a rota trata do `Content-Type` e do `Content-Disposition`.
 *
 * Por que a versão é a PUBLICADA quando existe: o PDF é o documento que o
 * cliente recebe para ler e imprimir. Se o ADMIN tiver rascunhado uma versão
 * posterior, o PDF tem de ser o que está no link — o mesmo argumento do item 45,
 * aplicado a um formato diferente. Sem versão publicada, usa a actual, porque
 * o PDF também é usado internamente como conferência antes do envio.
 */
export async function getProposalPdfInput(proposalId: string, versionNumber?: number) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { project: { include: { client: true } } },
  });
  if (!proposal) return notFound("Proposta");

  const target = versionNumber ?? proposal.publishedVersion ?? proposal.currentVersion;
  const version = await prisma.proposalVersion.findFirst({
    where: { proposalId, version: target },
  });
  if (!version) return notFound("Versão da proposta");

  const formalText = (version.formalText ?? {}) as Record<string, unknown>;
  const validityDays = typeof formalText.validityDays === "number" ? formalText.validityDays : null;

  await recordAudit({
    action: "PROPOSAL_PDF_GENERATED",
    entity: "Proposal",
    entityId: proposalId,
    entityVersion: version.version,
    actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
    metadata: {
      code: proposal.code,
      version: version.version,
      // Registrar qual versão saiu em PDF responde "o que o cliente recebeu em
      // papel" quando a proposta já tiver sido alterada.
      source: versionNumber === undefined && proposal.publishedVersion !== null ? "PUBLICADA" : "REQUERIDA",
      total: Number(version.total),
    },
  });

  return {
    code: proposal.code ?? null,
    title: version.title,
    version: version.version,
    clientName: proposal.project.client.fullName ?? proposal.project.client.name,
    projectName: proposal.project.name,
    projectDescription: proposal.project.description,
    services: version.services,
    total: Number(version.total),
    adjustment: Number(version.adjustment),
    frozenPaymentPlan: version.paymentPlan,
    formalText: version.formalText,
    validityDays,
    expiresAt: proposal.expiresAt,
    issuedAt: version.createdAt,
    company: {
      name: process.env.COMPANY_LEGAL_NAME ?? "ARQVERTICE",
      document: process.env.COMPANY_LEGAL_DOCUMENT ?? null,
    },
  };
}

/**
 * Link público da proposta, para o corpo do e-mail.
 *
 * Reutiliza a MESMA construção de URL do WhatsApp. Duas funções a montar a
 * mesma URL divergiriam na primeira alteração de ambiente, e o cliente receberia
 * um link que não abre — o pior resultado possível num e-mail comercial.
 */
export function proposalPublicUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "");
  if (!base && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL não configurada: o link da proposta ficaria inválido em produção.");
  }
  return `${base ?? "http://localhost:3000"}/briefing-proposta/${encodeURIComponent(token)}`;
}

/** FASE 4C, item 51 — envio da proposta por e-mail. */
export async function sendProposalEmail(proposalId: string) {
  const user = await requireRole("ADMIN");

  // A proposta tem de estar PUBLICADA para haver link a enviar. Sem esta
  // verificação, o e-mail sairia com um link que abre a recusa "expirou ou foi
  // revogado" — o pior resultado possível num e-mail comercial.
  const link = await prisma.proposalAccessLink.findFirst({
    where: { proposalId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, versionNumber: true },
  });
  if (!link?.versionNumber) {
    throw new Error("Publique a proposta antes de enviar por e-mail: é o link publicado que o cliente abre.");
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { project: { include: { client: true } }, versions: true },
  });
  if (!proposal) return notFound("Proposta");

  const client = proposal.project.client;
  // Sem e-mail cadastrado devolvemos um motivo explícito. Inventar um destinatário
  // ou simular um envio seria pior que dizer que falta o dado.
  if (!client.email) {
    throw new Error("O cliente não tem e-mail cadastrado. Use o WhatsApp ou actualize o cadastro.");
  }

  const version = proposal.versions.find((item) => item.version === link.versionNumber);
  if (!version) return notFound("Versão publicada da proposta");

  const formalText = (version.formalText ?? {}) as Record<string, unknown>;
  const validityDays = typeof formalText.validityDays === "number" ? formalText.validityDays : null;
  const token = createProposalToken();
  const url = proposalPublicUrl(token);

  // Item 39: o conteúdo vem do SISTEMA DE TEMPLATES, não de um texto escrito
  // aqui. Se o template faltar ou tiver variáveis por resolver, `resolveTemplate`
  // recusa e o envio não sai — nunca se envia `{{LINK}}` em claro ao cliente.
  const resolved = await resolveTemplate(
    "email.proposal",
    {
      CLIENTE: client.fullName ?? client.name,
      PROJETO: proposal.project.name,
      PROPOSTA: version.title,
      VALOR: formatCurrencyBRL(Number(version.total ?? 0)),
      VALIDADE: validityDays ? `${validityDays} dias` : null,
      LINK: url,
    },
    { blockOnMissing: true },
  );
  if (!resolved.ok) throw new Error(resolved.message);

  // O token é gerado AQUI e só o HASH é gravado. O valor em claro existe na
  // mensagem; a base nunca o vê — o mesmo modelo do `createProposalLink`.
  await prisma.proposalAccessLink.update({ where: { id: link.id }, data: { tokenHash: hashProposalToken(token) } });

  const result = await sendEmail({
    to: client.email,
    subject: `${proposal.code ?? "Proposta"} — ${proposal.project.name}`,
    text: resolved.text,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
      <tr><td>
        <p style="margin:0 0 4px;font-size:18px;font-weight:700">ARQVERTICE<span style="color:#2563eb">.</span></p>
        <p style="margin:0 0 24px;font-size:13px;color:#64748b">Arquitetura e Engenharia</p>
        <pre style="margin:0;font-family:inherit;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(resolved.text)}</pre>
      </td></tr>
    </table>
  </td></tr></table></body></html>`,
    eventType: COMMERCIAL_EVENT.PROPOSAL_SENT,
    entityType: "Proposal",
    entityId: proposalId,
  });

  await recordAudit({
    action: "PROPOSAL_EMAIL_SENT",
    entity: "Proposal",
    entityId: proposalId,
    entityVersion: link.versionNumber,
    actor: { actorId: user.id, actorRole: user.role, actorLabel: user.name, userId: user.id },
    metadata: {
      // O destinatário entra na auditoria; o LINK NÃO. O token em claro nunca
      // é auditado — só o hash fica na base, e é o que deve continuar lá.
      recipient: client.email,
      version: link.versionNumber,
      template: resolved.key,
      templateVersion: resolved.version,
      delivered: result.ok,
      configured: result.configured,
      error: result.error ?? null,
    },
  });

  return { sent: result.ok, configured: result.configured, error: result.error ?? null, recipient: client.email };
}

export async function generateContract(proposalId: string) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { include: { client: true, briefing: true } },
      versions: { orderBy: { version: "desc" }, take: 5 },
      contract: true,
    },
  });
  if (!proposal) return notFound("Proposta");
  if (proposal.status !== "APPROVED") throw new Error("Só é possível gerar o contrato de uma proposta aprovada.");
  if (proposal.contract) return proposal.contract;

  // Tópico 24: usa exatamente a versão aprovada, impedindo divergência entre
  // a proposta congelada e o contrato.
  // Tópico 34: o contrato aponta para a versão exata aprovada. Sem ela, geramos
  // por engano a versão mais recente e o contrato divergiria da aprovação.
  if (!proposal.approvedVersion) {
    throw new Error("A proposta aprovada não registra qual versão foi aprovada. Refaça a aprovação antes de gerar o contrato.");
  }
  const version = proposal.versions.find((item) => item.version === proposal.approvedVersion);
  if (!version) throw new Error("A versão aprovada da proposta não foi encontrada.");

  const services = Array.isArray(version.services) ? (version.services as Array<Record<string, unknown>>) : [];
  const formalText = (version.formalText as Record<string, unknown>) ?? {};

  // Tópico 26: o contrato escolhido reflete os serviços efetivamente contratados.
  const activeTemplates = await listActiveContractTemplates();
  const selection = selectContractTemplateForScope(activeTemplates, services);
  const template = selection.template;
  if (!template) throw new Error("Nenhum template contratual ativo. Configure-o no ambiente administrativo.");

  const client = proposal.project.client;
  const briefingResponses = (proposal.project.briefing?.responses ?? {}) as Record<string, unknown>;
  const validityDays = asString(formalText.validityDays);

  const rendered = buildContractText(template.body, {
    CLIENTE_NOME: client.fullName ?? client.name,
    CLIENTE_CPF: client.cpf ?? undefined,
    CLIENTE_RG: client.rg ?? undefined,
    CLIENTE_ENDERECO: formatAddress(client.address),
    CLIENTE_CIDADE: client.city ?? undefined,
    CONTRATADO_NOME: process.env.COMPANY_LEGAL_NAME ?? "ARQVERTICE",
    CONTRATADO_DOCUMENTO: process.env.COMPANY_LEGAL_DOCUMENT ?? undefined,
    PROJETO_NOME: proposal.project.name,
    PROJETO_DESCRICAO: proposal.project.description ?? undefined,
    AREA: asString(briefingResponses.area ?? briefingResponses.areaTotal ?? briefingResponses.metragem),
    SERVICOS: renderServices(services) || undefined,
    ETAPAS: asString(formalText.etapas),
    PRAZOS: asString(formalText.prazos),
    HONORARIOS: asString(formalText.honorarios),
    FORMA_PAGAMENTO: asString(formalText.formaPagamento),
    VALOR_TOTAL: formatCurrencyBRL(Number(version.total ?? 0)),
    VALIDADE: validityDays ? `${validityDays} dias` : undefined,
    DATA_CONTRATO: formatDateLongBR(proposal.approvedAt ?? new Date()),
  });
  if (rendered.missingRequired.length) {
    throw new Error(
      `Template contratual incompleto: variáveis obrigatórias ausentes ${rendered.missingRequired.join(", ")}.`,
    );
  }

  const content: ContractDraft = {
    object: `Contrato de prestação de serviços de projeto — ${proposal.project.name}`,
    parties: { client: client.fullName ?? client.name, project: proposal.project.name },
    services,
    formalText,
    total: Number(version.total ?? 0),
    proposalVersion: version.version,
    templateId: template.id,
    templateVersion: template.version,
    scopeKey: template.scopeKey,
    scopeReason: selection.reason,
    disciplines: selection.matched,
    text: rendered.text,
    missing: rendered.missing,
  };

  // Prompt 18, item 40 — IDEMPOTÊNCIA.
  //
  // `Contract.proposalId` é único por desenho (Tópico 34: o contrato aponta
  // para a proposta aprovada). Sem esta verificação, um duplo clique em
  // "Gerar contrato" provocava P2002 e um erro 500 opaco para o ADMIN, em vez
  // de devolver o contrato que já existe.
  const existente = await prisma.contract.findUnique({ where: { proposalId } });
  if (existente) {
    await recordAudit("CONTRACT_GENERATION_SKIPPED", "Contract", existente.id, user.id, {
      proposalId,
      proposalVersion: version.version,
      reason: "Já existe contrato para esta proposta; nada foi duplicado.",
    });
    return existente;
  }

  const contract = await prisma.contract.create({
    data: {
      proposalId,
      version: version.version,
      title: version.title,
      content: json(content),
      status: "DRAFT",
      templateId: template.id,
      templateVersion: template.version,
    },
  });
  await recordNotification({
    type: COMMERCIAL_EVENT.CONTRACT_GENERATED,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `Contrato gerado a partir da proposta versão ${version.version}.`,
    entityType: "Contract",
    entityId: contract.id,
    payload: {
      proposalId,
      proposalVersion: version.version,
      templateVersion: template.version,
      scopeKey: template.scopeKey,
      scopeReason: selection.reason,
      disciplines: selection.matched,
      missing: rendered.missing,
    },
  });
  await recordAudit("CONTRACT_GENERATED", "Contract", contract.id, user.id, { proposalId, version: version.version });
  return contract;
}
