import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import { recordNotification } from "@/server/services/notification-service";
import { COMMERCIAL_EVENT, NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from "@/lib/commercial-events";
import {
  SIGNATURE_STATUS,
  assertSignatureTransition,
  type SignatureProvider,
  type SignatureStatusName,
} from "@/lib/signature";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function normalizeProviderStatus(raw: unknown): SignatureStatusName {
  const value = typeof raw === "string" ? raw.toUpperCase() : "";
  const allowed: SignatureStatusName[] = ["SENT", "VIEWED", "SIGNED", "COMPLETED", "CANCELLED", "FAILED"];
  return allowed.find((status) => status === value) ?? SIGNATURE_STATUS.SENT;
}

/**
 * Provedor manual: registra a entrega do documento para assinatura fora da
 * plataforma. NÃO é assinatura jurídica digital — e o sistema não afirma que seja.
 */
const manualProvider: SignatureProvider = {
  name: "manual",
  isConfigured: true,
  providesLegalSignature: false,
  async send(input) {
    return {
      provider: "manual",
      status: SIGNATURE_STATUS.SENT,
      externalId: null,
      evidence: {
        mode: "manual",
        legalSignature: false,
        deliveredTo: input.signatory.name,
        note: "Assinatura realizada fora da plataforma; sem comprovação jurídica digital.",
      },
    };
  },
};

/** Provedor externo (API oficial). Credenciais somente no servidor. */
const httpProvider: SignatureProvider = {
  name: "http",
  isConfigured: Boolean(process.env.SIGNATURE_API_URL && process.env.SIGNATURE_API_TOKEN),
  providesLegalSignature: true,
  async send(input) {
    const url = process.env.SIGNATURE_API_URL;
    const token = process.env.SIGNATURE_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Provedor de assinatura configurado como 'http', mas SIGNATURE_API_URL/SIGNATURE_API_TOKEN não estão definidos no servidor.",
      );
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ document: input.document, signatory: input.signatory }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Provedor de assinatura respondeu ${response.status}. ${detail.slice(0, 200)}`);
    }
    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      evidence?: Record<string, unknown>;
    };
    return {
      provider: "http",
      status: normalizeProviderStatus(data.status),
      externalId: data.id ?? null,
      evidence: data.evidence ?? null,
    };
  },
  async refresh(externalId) {
    const url = process.env.SIGNATURE_API_URL;
    const token = process.env.SIGNATURE_API_TOKEN;
    if (!url || !token) throw new Error("Provedor de assinatura externo não configurado.");
    const response = await fetch(`${url.replace(/\/+$/, "")}/${encodeURIComponent(externalId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Provedor de assinatura respondeu ${response.status}.`);
    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      evidence?: Record<string, unknown>;
    };
    return {
      provider: "http",
      status: normalizeProviderStatus(data.status),
      externalId: data.id ?? externalId,
      evidence: data.evidence ?? null,
    };
  },
};

const PROVIDERS: Record<string, SignatureProvider> = { manual: manualProvider, http: httpProvider };

/** Trocar o fornecedor é apenas escolher outro provider registrado. */
export function getSignatureProvider(): SignatureProvider {
  const name = (process.env.SIGNATURE_PROVIDER ?? "manual").toLowerCase();
  return PROVIDERS[name] ?? manualProvider;
}

const EVENT_BY_STATUS: Partial<
  Record<SignatureStatusName, { type: (typeof COMMERCIAL_EVENT)[keyof typeof COMMERCIAL_EVENT]; label: string }>
> = {
  SENT: { type: COMMERCIAL_EVENT.CONTRACT_SENT, label: "Contrato enviado para assinatura" },
  VIEWED: { type: COMMERCIAL_EVENT.CONTRACT_VIEWED, label: "Contrato visualizado" },
  SIGNED: { type: COMMERCIAL_EVENT.CONTRACT_SIGNED, label: "Contrato assinado" },
};

async function recordEvent(
  status: SignatureStatusName,
  contractId: string,
  signatoryName: string,
  legalSignature: boolean,
) {
  const mapped = EVENT_BY_STATUS[status];
  if (!mapped) return;
  await recordNotification({
    type: mapped.type,
    channel: NOTIFICATION_CHANNEL.MANUAL,
    status: NOTIFICATION_STATUS.RECORDED,
    body: `${mapped.label} por ${signatoryName}.${legalSignature ? "" : " (sem comprovação jurídica digital)"}`,
    entityType: "Contract",
    entityId: contractId,
    payload: { signatoryName, legalSignature },
  });
}

export async function requestContractSignature(contractId: string) {
  const user = await requireRole("ADMIN");
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { proposal: { include: { project: { include: { client: true } } } }, signature: true },
  });
  if (!contract) return notFound("Contrato");
  if (!["DRAFT", "READY"].includes(contract.status)) {
    throw new Error("O contrato precisa estar em DRAFT ou READY para ir para assinatura.");
  }

  const provider = getSignatureProvider();
  if (!provider.isConfigured) {
    throw new Error(`Provedor de assinatura “${provider.name}” não está configurado no servidor.`);
  }

  const content = (contract.content ?? {}) as Record<string, unknown>;
  const client = contract.proposal.project.client;
  const signatory = { name: client.fullName ?? client.name, email: client.email, phone: client.phone };
  const result = await provider.send({
    contractId,
    document: {
      contractId,
      contractVersion: contract.version,
      title: contract.title,
      text: typeof content.text === "string" ? content.text : "",
    },
    signatory,
  });

  assertSignatureTransition(contract.signature?.status ?? SIGNATURE_STATUS.PENDING, result.status);
  const now = new Date();
  const evidence = result.evidence ? json(result.evidence) : Prisma.DbNull;
  const signature = await prisma.contractSignature.upsert({
    where: { contractId },
    create: {
      contractId,
      provider: result.provider,
      externalId: result.externalId,
      signatoryName: signatory.name,
      signatoryEmail: signatory.email,
      signatoryPhone: signatory.phone,
      status: result.status,
      sentAt: now,
      evidence,
    },
    update: {
      provider: result.provider,
      externalId: result.externalId,
      status: result.status,
      sentAt: now,
      lastError: null,
      evidence,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: result.status === SIGNATURE_STATUS.SIGNED ? "SIGNED" : "SENT", sentAt: now },
  });
  await recordEvent(result.status, contractId, signatory.name, provider.providesLegalSignature);
  await recordAudit("CONTRACT_SIGNATURE_REQUESTED", "ContractSignature", signature.id, user.id, {
    provider: result.provider,
    externalId: result.externalId,
  });
  return signature;
}

/** Avança o status (usado pelo provedor manual e por callbacks autorizados). */
export async function advanceSignatureStatus(
  contractId: string,
  status: SignatureStatusName,
  evidence?: Record<string, unknown>,
) {
  const user = await requireRole("ADMIN");
  const current = await prisma.contractSignature.findUnique({ where: { contractId } });
  if (!current) return notFound("Solicitação de assinatura");
  assertSignatureTransition(current.status, status);

  const now = new Date();
  const signature = await prisma.contractSignature.update({
    where: { contractId },
    data: {
      status,
      viewedAt: status === SIGNATURE_STATUS.VIEWED ? now : current.viewedAt,
      signedAt: status === SIGNATURE_STATUS.SIGNED || status === SIGNATURE_STATUS.COMPLETED ? now : current.signedAt,
      completedAt: status === SIGNATURE_STATUS.COMPLETED ? now : current.completedAt,
      ...(evidence ? { evidence: json(evidence) } : {}),
    },
  });
  if (status === SIGNATURE_STATUS.SIGNED || status === SIGNATURE_STATUS.COMPLETED) {
    await prisma.contract.update({ where: { id: contractId }, data: { status: "SIGNED", signedAt: now } });
  }
  await recordEvent(status, contractId, signature.signatoryName, getSignatureProvider().providesLegalSignature);
  await recordAudit("CONTRACT_SIGNATURE_UPDATED", "ContractSignature", signature.id, user.id, { status });
  return signature;
}