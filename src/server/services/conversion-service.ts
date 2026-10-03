import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit, systemActor } from "@/server/audit";
import { recordNotification } from "@/server/services/notification-service";
import { storeCommercialDocument } from "@/server/services/document-service";
import { AUDIT_ACTION, AUDIT_ENTITY } from "@/lib/audit-events";
import { COMMERCIAL_EVENT, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from "@/lib/commercial-events";
import {
  buildInstallmentDueDates,
  buildPaymentPlan,
  resolvePaymentPlanForVersion,
  toPaymentRecords,
} from "@/lib/payment-plan";

export type ConversionOutcome = {
  converted: boolean;
  alreadyConverted: boolean;
  proposalId: string;
  contractId: string;
  clientId: string;
  projectId: string;
  projectStatusBefore: string;
  projectStatusAfter: string;
  installmentsCreated: number;
  installmentsSkipped: number;
  paymentsSkippedReason: string | null;
  /** Quantos documentos comerciais foram gravados nesta execução. */
  documentsStored?: number;
};

/**
 * Tópico 39 — grava proposta e contrato no módulo de documentos existente.
 *
 * Todas as chamadas são idempotentes por `sourceKey`; uma falha parcial não
 * duplica nada na reexecução.
 */
async function storeCommercialDocuments(input: {
  projectId: string;
  proposalId: string;
  contractId: string;
  proposalTitle: string;
  proposalVersion: number;
  total: number;
  services: unknown[];
  contractBody: string;
}) {
  const proposalLines = input.services
    .map((service) => {
      const item = service as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name : "Serviço";
      const quantity = typeof item.quantity === "number" ? item.quantity : 1;
      const unit = typeof item.unit === "string" ? item.unit : "un.";
      const subtotal = typeof item.subtotal === "number" ? item.subtotal : 0;
      return `- ${name}: ${quantity} ${unit} — R$ ${subtotal.toFixed(2).replace(".", ",")}`;
    })
    .join("\n");

  const proposalText = [
    input.proposalTitle,
    "",
    `Versão ${input.proposalVersion}`,
    "",
    "SERVIÇOS",
    proposalLines || "- Nenhum serviço listado.",
    "",
    `VALOR TOTAL: R$ ${input.total.toFixed(2).replace(".", ",")}`,
  ].join("\n");

  const results = [];

  results.push(
    await storeCommercialDocument({
      projectId: input.projectId,
      name: `${input.proposalTitle} (v${input.proposalVersion}).txt`,
      text: proposalText,
      source: "PROPOSAL",
      proposalId: input.proposalId,
      sourceKey: `proposal:${input.proposalId}:v${input.proposalVersion}`,
      visibility: "CLIENT",
    }),
  );

  if (input.contractBody.trim()) {
    results.push(
      await storeCommercialDocument({
        projectId: input.projectId,
        name: "Contrato.txt",
        text: input.contractBody,
        source: "CONTRACT",
        proposalId: input.proposalId,
        contractId: input.contractId,
        sourceKey: `contract:${input.contractId}`,
        visibility: "CLIENT",
      }),
    );
  }

  return { created: results.filter((item) => item.created).length };
}

/**
 * Tópico 37 — conversão automática.
 *
 * LEAD/ORÇAMENTO → CLIENTE CONTRATADO → SERVIÇO ATIVO → PROJETO EM EXECUÇÃO
 *
 * Duas garantias sustentam a automação:
 *
 *  1. **Não duplica CLIENT nem PROJECT.** A proposta já pertence a um projeto
 *     que já pertence a um cliente (Tópico 34). A conversão apenas move o
 *     projeto de PLANNING para IN_PROGRESS — nunca cria entidades novas.
 *
 *  2. **É idempotente.** Tudo numa transação única e cada passo tem chave
 *     estável (Tópicos 38/39). Reexecutar não duplica parcelas nem documentos:
 *     os índices únicos do banco são a rede de segurança final.
 */
export async function convertApprovedProposal(proposalId: string): Promise<ConversionOutcome> {
  await requireRole("ADMIN");

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { select: { id: true, name: true, status: true, startDate: true, clientId: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      contract: { select: { id: true, status: true } },
    },
  });
  if (!proposal) return notFound("Proposta");

  // Pré-condições do Tópico 37: só converte o que está aprovado E assinado.
  if (proposal.status !== "APPROVED") {
    throw new Error("Só é possível converter uma proposta aprovada.");
  }
  if (!proposal.contract) throw new Error("A proposta aprovada ainda não tem contrato.");
  if (proposal.contract.status !== "SIGNED") {
    throw new Error("Só é possível converter um contrato assinado.");
  }

  const contract = proposal.contract;
  const project = proposal.project;
  const version = proposal.versions[0];
  const approvedVersion = proposal.approvedVersion ?? version?.version ?? 1;

  const client = await prisma.client.findUnique({
    where: { id: project.clientId },
    select: { id: true, status: true },
  });

  // Idempotência: já convertida, não há o que fazer.
  if (proposal.convertedAt) {
    return {
      converted: false,
      alreadyConverted: true,
      proposalId,
      contractId: contract.id,
      clientId: project.clientId,
      projectId: project.id,
      projectStatusBefore: project.status,
      projectStatusAfter: project.status,
      installmentsCreated: 0,
      installmentsSkipped: 0,
      paymentsSkippedReason: "Proposta já convertida anteriormente.",
    };
  }

  const total = Number(version?.total ?? 0);
  const formalText = (version?.formalText ?? {}) as Record<string, unknown>;

  // Prompt 18, item 5 — as parcelas vêm do plano CONGELADO na versão aprovada.
  // Re-derivar aqui criava parcelas potencialmente diferentes das que o cliente
  // aprovou: o total do ficheiro já estava correcto, mas a distribuição não.
  const resolvedPlan = resolvePaymentPlanForVersion({
    frozen: version?.paymentPlan,
    formalText,
    total,
  });
  const plan = buildPaymentPlan(total, resolvedPlan.snapshot.installments);
  const dueDates = buildInstallmentDueDates(project.startDate ?? new Date(), plan.installments.length);

  const records = toPaymentRecords(plan, {
    projectId: project.id,
    proposalId,
    proposalVersion: approvedVersion,
  }).map((record, index) => ({ ...record, dueDate: dueDates[index] ?? null }));

  const result = await prisma.$transaction(async (tx) => {
    // 1. SERVIÇO ATIVO / PROJETO EM EXECUÇÃO — apenas muda o estado do projeto
    //    que já existe. Nunca cria um novo Project.
    const updatedProject = await tx.project.update({
      where: { id: project.id },
      data: { status: "IN_PROGRESS", startDate: project.startDate ?? new Date() },
      select: { status: true },
    });

    // 2. CLIENTE CONTRATADO — o cliente já existe; garantimos que está ativo.
    if (client && client.status !== "ACTIVE") {
      await tx.client.update({ where: { id: client.id }, data: { status: "ACTIVE" } });
    }

    // 3. Tópico 38 — parcelas do plano aprovado, criadas apenas as que faltam.
    let created = 0;
    let skipped = 0;
    for (const record of records) {
      try {
        await tx.payment.create({ data: record });
        created += 1;
      } catch (error) {
        // Chave duplicada = parcela já gerada por uma execução anterior.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    // 4. Marca de conversão, gravada na MESMA transação dos efeitos acima.
    await tx.proposal.update({
      where: { id: proposalId },
      data: { convertedAt: new Date(), conversionKey: `proposal:${proposalId}` },
    });

    return { projectStatus: updatedProject.status, created, skipped };
  });

  const outcome: ConversionOutcome = {
    converted: true,
    alreadyConverted: false,
    proposalId,
    contractId: contract.id,
    clientId: project.clientId,
    projectId: project.id,
    projectStatusBefore: project.status,
    projectStatusAfter: result.projectStatus,
    installmentsCreated: result.created,
    installmentsSkipped: result.skipped,
    paymentsSkippedReason: plan.installments.length
      ? null
      : "A proposta aprovada não define percentuais de pagamento; nenhuma parcela foi criada.",
  };

  // Tópico 39 — documentos comerciais no módulo de documentos EXISTENTE.
  // Ficam fora da transação acima de propósito: o storage não participa de uma
  // transação PostgreSQL. Como `sourceKey` é estável, reexecutar apenas
  // reencontra o arquivo em vez de duplicá-lo.
  const contractText = await prisma.contract.findUnique({
    where: { id: contract.id },
    select: { content: true, title: true },
  });
  const contractBody = (contractText?.content ?? {}) as Record<string, unknown>;

  const stored = await storeCommercialDocuments({
    projectId: project.id,
    proposalId,
    contractId: contract.id,
    proposalTitle: version?.title ?? "Proposta comercial",
    proposalVersion: approvedVersion,
    total,
    services: Array.isArray(version?.services) ? version.services : [],
    contractBody: typeof contractBody.text === "string" ? contractBody.text : "",
  });

  outcome.documentsStored = stored.created;

  await recordAudit({
    action: AUDIT_ACTION.CONVERSION_COMPLETED,
    entity: AUDIT_ENTITY.PROPOSAL,
    entityId: proposalId,
    entityVersion: approvedVersion,
    fromStatus: "APPROVED",
    toStatus: "CONVERTED",
    actor: systemActor(),
    metadata: {
      projectId: project.id,
      contractId: contract.id,
      clientId: project.clientId,
      fromProjectStatus: project.status,
      toProjectStatus: result.projectStatus,
      installmentsCreated: result.created,
      installmentsSkipped: result.skipped,
      total,
      paymentPlan: plan.installments.map((i) => `${i.label}: ${i.percent}% = ${i.amount}`),
    },
  });

  if (result.created > 0) {
    await recordAudit({
      action: AUDIT_ACTION.PAYMENTS_GENERATED,
      entity: AUDIT_ENTITY.PROPOSAL,
      entityId: proposalId,
      entityVersion: approvedVersion,
      actor: systemActor(),
      metadata: {
        count: result.created,
        total,
        plan: plan.installments,
        note: "Parcelas derivadas da condição de pagamento aprovada na proposta.",
      },
    });
  }

  await recordNotification({
    type: COMMERCIAL_EVENT.CONTRACT_SIGNED,
    channel: NOTIFICATION_CHANNEL.INTERNAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `Conversão concluída: projeto ${project.name} em execução com ${result.created} parcela(s).`,
    entityType: "Proposal",
    entityId: proposalId,
    payload: { projectId: project.id, contractId: contract.id, installments: result.created },
  });

  return outcome;
}

/**
 * Verifica se uma proposta está em condição de converter, sem efeitos colaterais.
 * Usado pela interface para mostrar o botão apenas quando faz sentido.
 */
export async function getConversionReadiness(proposalId: string) {
  await requireRole("ADMIN");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      project: { select: { status: true } },
      contract: { select: { status: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  });
  if (!proposal) return notFound("Proposta");

  const version = proposal.versions[0];
  const formalText = (version?.formalText ?? {}) as Record<string, unknown>;
  // Mesma regra do resto do sistema: primeiro o plano congelado.
  const resolvedPlan = resolvePaymentPlanForVersion({
    frozen: version?.paymentPlan,
    formalText,
    total: Number(version?.total ?? 0),
  });
  const parsed = resolvedPlan.snapshot.installments.length ? resolvedPlan.snapshot.installments : null;
  const blockers: string[] = [];

  if (proposal.status !== "APPROVED") blockers.push("A proposta ainda não está aprovada.");
  if (!proposal.contract) blockers.push("A proposta não tem contrato gerado.");
  else if (proposal.contract.status !== "SIGNED") blockers.push("O contrato ainda não está assinado.");
  if (!parsed) blockers.push("A proposta não define uma condição de pagamento com percentuais válidos.");
  // Uma versão anterior à migração continua convertível, mas o ADMIN é avisado
  // de que o plano ainda não está congelado.
  blockers.push(...resolvedPlan.warnings);

  return {
    ready: blockers.length === 0,
    blockers,
    alreadyConverted: Boolean(proposal.convertedAt),
    convertedAt: proposal.convertedAt,
    projectStatus: proposal.project.status,
    contractStatus: proposal.contract?.status ?? null,
    paymentPlan: parsed,
    total: Number(version?.total ?? 0),
  };
}


