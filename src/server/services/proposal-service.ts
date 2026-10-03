import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import { recordNotification } from "@/server/services/notification-service";
import { listActiveContractTemplates, resolveTemplate } from "@/server/services/message-template-service";
import { dispatchWhatsAppMessage } from "@/server/services/whatsapp-service";
import { COMMERCIAL_EVENT, MESSAGE_TEMPLATE_KEY, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from "@/lib/commercial-events";
import { createProposalToken, hashProposalToken } from "@/lib/proposal-token";
import {
  canDecideProposal,
  canEditProposal,
  canIssueProposalLink,
  enforceProposalRateLimit,
  isWellFormedProposalToken,
  RateLimitError,
} from "@/lib/proposal-access";
import { freezePaymentPlan } from "@/lib/payment-plan";
// Prompt 19, item 12: `buildWhatsAppMessage` deixou de ser importado. Era o
// segundo sistema de renderização de mensagens — exactamente o "sistema
// paralelo" que o item proíbe. A renderização passou a ser `resolveTemplate`.
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { buildContractText, formatCurrencyBRL, formatDateLongBR } from "@/lib/contract-template";
import { selectContractTemplateForScope } from "@/lib/commercial-scope";
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

export async function createProposal(projectId: string) {
  const user = await requireRole("ADMIN");
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } });
  if (!project) return notFound("Projeto");
  const existing = await prisma.proposal.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (existing) return existing;
  const proposal = await prisma.proposal.create({
    data: {
      projectId,
      versions: {
        create: {
          version: 1,
          title: `Proposta para ${project.name}`,
          presentation: json({ slides: [{ type: "cover", title: project.name }] }),
          formalText: json({ object: "Proposta comercial", validityDays: 30 }),
          services: json([]),
          subtotal: 0,
          total: 0,
          authorId: user.id,
        },
      },
    },
    include: { versions: true },
  });
  await recordAudit("PROPOSAL_CREATED", "Proposal", proposal.id, user.id, { projectId });
  await recordNotification({
    type: COMMERCIAL_EVENT.PROPOSAL_GENERATED,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `Proposta criada em rascunho para o projeto ${project.name}.`,
    entityType: "Proposal",
    entityId: proposal.id,
    payload: { projectId, version: 1 },
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

export async function saveProposalVersion(proposalId: string, content: ProposalContent) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { id: true, currentVersion: true, status: true } });
  if (!proposal) return notFound("Proposta");
  // Tópico 34 — uma proposta aprovada é imutável; qualquer mudança exige uma
  // nova proposta, nunca a reescrita de uma versão já aceita pelo cliente.
  if (!canEditProposal(proposal.status)) throw new Error("A proposta aprovada está congelada.");

  const version = proposal.currentVersion + 1;
  const total = Number(content.total ?? 0);
  const formalText = (content.formalText ?? {}) as Record<string, unknown>;

  // Prompt 18, item 2 — CONGELAMENTO DO PLANO DE PAGAMENTO.
  // É aqui, na gravação da versão, que o plano passa de texto livre a dado
  // estruturado. A partir deste momento ADMIN e cliente lêem o mesmo objecto,
  // e a proposta publicada torna-se historicamente reproduzível (item 5).
  const plan = freezePaymentPlan({ formalText, total });

  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.proposalVersion.create({
      data: {
        proposalId,
        version,
        title: content.title,
        presentation: json(content.presentation),
        formalText: json(content.formalText),
        services: json(content.services),
        subtotal: new Prisma.Decimal(content.subtotal),
        adjustment: new Prisma.Decimal(content.adjustment ?? 0),
        total: new Prisma.Decimal(total),
        paymentPlan: json(plan),
        authorId: user.id,
      },
    });
    await tx.proposal.update({ where: { id: proposalId }, data: { currentVersion: version, status: "DRAFT", expiresAt: content.expiresAt ?? null } });
    return created;
  });
  await recordAudit("PROPOSAL_VERSION_CREATED", "ProposalVersion", result.id, user.id, {
    proposalId,
    version,
    // A origem do plano fica na auditoria: responde "de onde veio este plano".
    paymentPlanSource: plan.derivedFrom,
    paymentPlanInstallments: plan.installments.length,
  });
  return result;
}

export async function createProposalLink(proposalId: string) {
  const user = await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { id: true, expiresAt: true, status: true } });
  if (!proposal) return notFound("Proposta");
  // Tópico 35 — emitir link para uma proposta já aprovada, expirada ou cancelada
  // reabriria um ciclo comercial encerrado.
  if (!canIssueProposalLink(proposal.status)) {
    throw new Error("Não é possível gerar link para uma proposta encerrada.");
  }

  await prisma.proposalAccessLink.updateMany({ where: { proposalId, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = createProposalToken();
  await prisma.proposalAccessLink.create({ data: { proposalId, tokenHash: hashProposalToken(token), expiresAt: proposal.expiresAt } });
  await prisma.proposal.update({ where: { id: proposalId }, data: { status: "SENT", sentAt: new Date() } });
  await recordAudit("PROPOSAL_SENT", "Proposal", proposalId, user.id);
  await recordNotification({
    type: COMMERCIAL_EVENT.PROPOSAL_SENT,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: "Link seguro da proposta (re)gerado e enviado.",
    entityType: "Proposal",
    entityId: proposalId,
  });
  return { token };
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
export async function resolveProposalAccess(token: string, clientKey: string) {
  if (!isWellFormedProposalToken(token)) throw new Error("Link de proposta inválido.");
  enforceProposalRateLimit("view", clientKey);
  const link = await prisma.proposalAccessLink.findUnique({
    where: { tokenHash: hashProposalToken(token) },
    include: { proposal: { include: { project: { include: { client: true } }, versions: { orderBy: { version: "desc" }, take: 1 } } } },
  });
  if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) {
    // Tópico 35 — tentativa negada fica registrada; o banco não guarda o token,
    // apenas o hash, então registramos a origem e nunca o segredo.
    await recordAudit("PROPOSAL_ACCESS_DENIED", "Proposal", link?.proposalId, undefined, {
      reason: link ? "revoked_or_expired" : "unknown_token",
      clientKey,
    });
    logInfo("proposal_access_denied", { reason: link ? "revoked_or_expired" : "unknown_token", clientKey });
    throw new Error("Este link de proposta expirou ou foi revogado.");
  }
  return link;
}

export async function resolveProposalToken(token: string, clientKey: string) {
  const link = await resolveProposalAccess(token, clientKey);
  const now = new Date();
  const [, viewed] = await prisma.$transaction([
    prisma.proposalAccessLink.update({ where: { id: link.id }, data: { firstAccessAt: link.firstAccessAt ?? now, lastAccessAt: now } }),
    prisma.proposal.updateMany({ where: { id: link.proposalId, status: { in: ["SENT", "GENERATED"] } }, data: { status: "VIEWED", viewedAt: now } }),
  ]);
  if (viewed.count > 0) {
    await recordNotification({
      type: COMMERCIAL_EVENT.PROPOSAL_VIEWED,
      channel: NOTIFICATION_CHANNEL.INTERNAL,
      status: NOTIFICATION_STATUS.RECORDED,
      body: "Proposta visualizada pelo cliente.",
      entityType: "Proposal",
      entityId: link.proposalId,
      payload: { viewedAt: now.toISOString() },
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
  if (!canDecideProposal(proposal.status)) {
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
        where: { proposalId: proposal.id, version: proposal.currentVersion, frozenAt: null },
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
            ? `Proposta versão ${proposal.currentVersion} aprovada e versão congelada.`
            : `Proposta versão ${proposal.currentVersion} recusada.`,
        entityType: "Proposal",
        entityId: proposal.id,
        payload: json({
          ...metadata,
          version: proposal.currentVersion,
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
            approvedVersion: proposal.currentVersion,
            approvalIp: typeof metadata?.ip === "string" ? metadata.ip : null,
            approvalMeta: metadata ? json(metadata) : undefined,
          }
        : { status: "REJECTED", rejectedAt: now },
      include: { project: { include: { client: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
    });
  });
  await recordAudit(`PROPOSAL_${decision}`, "Proposal", proposal.id, undefined, { ...metadata, version: proposal.currentVersion });
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
