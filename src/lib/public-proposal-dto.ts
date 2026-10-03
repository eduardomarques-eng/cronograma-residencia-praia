import type { PaymentPlanLine, PaymentPlanSnapshot } from "./payment-plan";

/**
 * Prompt 18, item 4 — DTO da proposta pública.
 *
 * Este tipo é uma LISTA DE PERMISSÃO, não um recorte conveniente. Tudo o que
 * o cliente pode ver está escrito aqui; tudo o que não está, não sai.
 *
 * A garantia não está em lembrar-me de apagar campos ao montar o objecto — o
 * objecto é construído campo a campo, a partir de uma entrada estreita já
 * seleccionada da base de dados. Não existe caminho em que um campo interno
 * "escape" para o payload público.
 *
 * Campos deliberadamente AUSENTES: identificadores internos, token de acesso,
 * auditoria, custo/margem, regras de precificação, histórico de versões, dados
 * pessoais do cliente além do nome, e qualquer referência a outros clientes.
 */

export type PublicServiceLine = {
  name: string;
  discipline: string | null;
  unit: string | null;
  quantity: number | null;
  /** Preço unitário publicado: é parte do investimento aprovado. */
  unitPrice: number | null;
  subtotal: number;
};

export type PublicSlide = { title: string; body: string };

export type PublicSchedule = {
  totalDays: number | null;
  tasks: Array<{ name: string; startDay: number; endDay: number; state: string }>;
  criticalPath: string[];
};

export type PublicCompany = { name: string; document: string | null };

export type PublicProposalDTO = {
  /** Identificação do documento publicado. */
  title: string;
  version: number;
  issuedAt: string | null;
  expiresAt: string | null;

  /** Cliente: apenas o nome. O resto é dado pessoal que a proposta não exige. */
  clientName: string;
  projectName: string;

  /** Conteúdo comercial publicado. */
  slides: PublicSlide[];
  object: string | null;
  conditions: string | null;

  /** Serviços publicados. */
  services: PublicServiceLine[];

  /** Valores publicados. */
  subtotal: number;
  adjustment: number;
  total: number;

  /**
   * Plano de pagamento CONGELADO na versão publicada (Prompt 18, item 5).
   * Nunca recalculado aqui, nunca re-derivado no cliente.
   */
  paymentPlan: PaymentPlanLine[];

  validityDays: number | null;
  schedule: PublicSchedule | null;
  company: PublicCompany;
  portfolio: Array<{ url: string; altText: string | null; discipline: string | null }>;
  formalText: string;
};

/** Entrada estreita: só o que o DTO pode usar. */
export type PublicProposalSource = {
  version: {
    version: number;
    title: string;
    createdAt: Date | string | null;
    services: unknown;
    subtotal: unknown;
    adjustment: unknown;
    total: unknown;
    formalText: unknown;
    presentation: unknown;
    /** Plano congelado, tal como persistido; validado pelo leitor. */
    paymentPlan?: unknown;
  };
  proposal: { expiresAt: Date | string | null };
  client: { name: string; fullName: string | null };
  project: { name: string };
  plan: PaymentPlanSnapshot;
  schedule?: PublicSchedule | null;
  portfolio?: Array<{ url: string; altText: string | null; discipline: string | null }>;
  formalText?: string;
  company?: Partial<PublicCompany>;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return typeof value === "string" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Constrói o DTO público, campo a campo.
 *
 * A entrada é deliberadamente estreita (`PublicProposalSource`): quem chama já
 * seleccionou do banco apenas o que pode ser publicado, portanto não há como
 * este builder expor algo que não lhe foi dado.
 */
export function buildPublicProposalDTO(source: PublicProposalSource): PublicProposalDTO {
  const formalText = asRecord(source.version.formalText);
  const presentation = asRecord(source.version.presentation);

  const services: PublicServiceLine[] = Array.isArray(source.version.services)
    ? (source.version.services as unknown[])
        .map((entry) => {
          const item = asRecord(entry);
          return {
            name: asText(item.name) ?? "Serviço",
            discipline: asText(item.discipline),
            unit: asText(item.unit),
            quantity:
              typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : null,
            unitPrice:
              typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) ? item.unitPrice : null,
            subtotal: toNumber(item.subtotal),
          };
        })
        // Linha sem nome e sem valor não é conteúdo publicável.
        .filter((line) => line.name !== "Serviço" || line.subtotal > 0)
    : [];

  const rawSlides = Array.isArray(presentation.slides) ? presentation.slides : [];
  const slides: PublicSlide[] = rawSlides
    .map((entry) => {
      const slide = asRecord(entry);
      return { title: asText(slide.title) ?? "", body: asText(slide.body) ?? "" };
    })
    .filter((slide) => slide.title || slide.body);

  return {
    title: asText(source.version.title) ?? "Proposta comercial",
    version: Number(source.version.version) || 1,
    issuedAt: toIso(source.version.createdAt),
    expiresAt: toIso(source.proposal.expiresAt),

    clientName: source.client.fullName ?? source.client.name,
    projectName: source.project.name,

    slides,
    object: asText(formalText.object),
    conditions: asText(formalText.conditions),

    services,

    subtotal: toNumber(source.version.subtotal),
    adjustment: toNumber(source.version.adjustment),
    total: toNumber(source.version.total),

    paymentPlan: source.plan.installments,

    validityDays: typeof formalText.validityDays === "number" ? formalText.validityDays : null,
    schedule: source.schedule ?? null,

    company: {
      name: asText(source.company?.name) ?? "ARQVERTICE",
      document: asText(source.company?.document),
    },
    portfolio: source.portfolio ?? [],
    formalText: source.formalText ?? "",
  };
}

/**
 * Campos que nunca podem aparecer num payload público.
 *
 * Existe como constante executável, não só como comentário: o teste de
 * segurança percorre esta lista contra o DTO construído. Se alguém acrescentar
 * um campo perigoso, o teste falha em vez de a fuga passar despercebida.
 */
export const FORBIDDEN_PUBLIC_KEYS = [
  "token",
  "tokenHash",
  "proposalId",
  "contractId",
  "projectId",
  "clientId",
  "versionId",
  "authorId",
  "approvalIp",
  "approvalMeta",
  "auditLogs",
  "pricing",
  "calculationRules",
  "cost",
  "margin",
  "baseLow",
  "baseMedium",
  "baseHigh",
  "history",
  "revisions",
  "email",
  "phone",
  "cpf",
  "rg",
] as const;
