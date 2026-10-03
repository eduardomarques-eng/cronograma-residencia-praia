import { buildCommercialNarrative, type NarrativeSection } from "./commercial-narrative";
import { renderTemplate } from "./template-engine";
import { NARRATIVE_SECTIONS } from "./template-registry";
import {
  resolvePortfolioSelection,
  type PortfolioContext,
  type PortfolioImage,
  type PortfolioOverrides,
} from "./portfolio";
import { buildSmartSchedule, type ScheduleTask, type SmartSchedule } from "./smart-schedule";
import { formatCurrencyBRL } from "./contract-template";

/**
 * Tópico 40 — gerador de documentos, independente da tela.
 *
 * Recebe as ENTIDADES (proposta, versão, cliente, projeto, serviços, preços,
 * portfólio, plano de pagamento) e devolve DOCUMENTOS prontos. Nenhuma
 * dependência de React, banco ou componente: a mesma função serve a página do
 * cliente, o preview do ADMIN (Tópico 41) e a exportação.
 *
 * Reprodutibilidade: a saída é função pura das entradas. Sem `Date.now()`, sem
 * aleatoriedade, sem leitura do ambiente. Os mesmos dados produzem sempre o
 * mesmo documento — requisito do Tópico 40.
 */

export type GeneratorClient = {
  name: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
};

export type GeneratorProject = {
  id: string;
  name: string;
  description?: string | null;
  type?: string | null;
};

export type GeneratorServiceLine = {
  name: string;
  discipline?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  subtotal?: number | null;
  scope?: string | null;
  /** Prazo configurado pelo ADMIN para este serviço. */
  estimatedDays?: number | null;
};

export type GeneratorPricing = {
  subtotal: number;
  adjustment?: number;
  total: number;
  /** Memória de cálculo vinda da versão aprovada. */
  memory?: string[];
};

export type PaymentPlanLine = { label: string; percent: number; amount: number };

/**
 * As ENTRADAS do gerador (Tópico 40): as entidades que produzem o documento.
 * Tudo o que o gerador precisa está aqui — nenhuma consulta a banco, nenhuma
 * dependência de tela.
 */
export type GeneratorInput = {
  proposal: { id: string; status: string; version: number; expiresAt?: Date | string | null };
  client: GeneratorClient;
  project: GeneratorProject;
  services: GeneratorServiceLine[];
  pricing: GeneratorPricing;
  portfolio?: PortfolioImage[];
  paymentPlan?: PaymentPlanLine[];
  scheduleTasks?: ScheduleTask[];
  briefingResponses?: Record<string, unknown> | null;
  portfolioOverrides?: Record<string, string>;
  /** Passo seguinte escrito pelo ADMIN; nunca gerado pelo sistema. */
  nextStep?: string | null;
  validityDays?: number | null;
};

export type GeneratedSlide = {
  key: string;
  title: string;
  body: string;
  origin: string;
  evidence: string[];
  images: Array<{ url: string; altText: string | null; reason: string }>;
};

export type GeneratedDocument = {
  /** Metadados de reprodução — o que permite reconstruir o documento depois. */
  fingerprint: string;
  generatedFrom: { proposalId: string; version: number; status: string };
  /** Identificação real, usada na capa da apresentação. */
  clientName: string;
  projectName: string;
  narrative: NarrativeSection[];
  slides: GeneratedSlide[];
  schedule: SmartSchedule;
  totals: { subtotal: number; adjustment: number; total: number; currency: string };
  services: GeneratorServiceLine[];
  paymentPlan: PaymentPlanLine[];
  formalText: string;
  warnings: string[];
};

/** Constrói a lista de etapas a partir dos serviços contratados (Tópico 42). */
function scheduleFromServices(services: GeneratorServiceLine[]): ScheduleTask[] {
  return services.map((service, index) => ({
    id: `servico:${index}:${service.name}`,
    name: service.name,
    discipline: service.discipline ?? null,
    durationDays: service.estimatedDays ?? null,
  }));
}

/**
 * Escolhe a imagem que reforça este serviço específico (Tópico 44).
 *
 * Recebe os overrides e delega a `resolvePortfolioSelection`: o gerador não
 * tem regra própria de substituição (Prompt 18, itens 19 e 20).
 */
function imagesForService(
  images: PortfolioImage[],
  service: GeneratorServiceLine,
  overrides?: PortfolioOverrides,
): Array<{ url: string; altText: string | null; reason: string }> {
  const context: PortfolioContext = { discipline: service.discipline ?? null };
  return resolvePortfolioSelection({ images, context, overrides, limit: 1 })
    .filter((item) => item.state !== "REMOVIDA")
    .map((item) => ({
      url: item.image.url,
      altText: item.image.altText ?? service.name,
      // A razão entra no documento: o ADMIN vê por que a imagem está ali.
      reason: item.reasons.join(", ") || "seleção do portfólio",
    }));
}

/**
 * Gera o documento completo a partir das entidades.
 *
 * Se o ADMIN já tiver escrito texto na versão, a narrativa entra como estrutura
 * de apoio: o sistema nunca substitui texto escrito por texto gerado.
 */
export function generateProposalDocument(input: GeneratorInput): GeneratedDocument {
  const warnings: string[] = [];

  const schedule = buildSmartSchedule(
    input.scheduleTasks?.length ? input.scheduleTasks : scheduleFromServices(input.services),
  );
  warnings.push(...schedule.warnings);

  const scheduleSummary =
    schedule.totalDays !== null
      ? `previsto em ${schedule.totalDays} ${schedule.totalDays === 1 ? "dia" : "dias"}`
      : null;
  if (schedule.totalDays === null) {
    warnings.push("Prazo total inconclusivo: configure os prazos dos serviços.");
  }

  const paymentCondition = input.paymentPlan?.length
    ? input.paymentPlan.map((line) => `${line.label} (${line.percent}%)`).join(", ")
    : null;

  const narrative = buildCommercialNarrative({
    clientName: input.client.fullName ?? input.client.name,
    projectName: input.project.name,
    projectDescription: input.project.description,
    briefingResponses: input.briefingResponses,
    services: input.services as unknown as Array<Record<string, unknown>>,
    total: input.pricing.total,
    paymentCondition,
    scheduleSummary,
    nextStep: input.nextStep,
    validityDays: input.validityDays,
  });

  const slides: GeneratedSlide[] = narrative.map((section) => {
    const related =
      section.key === "DELIVERABLES"
        ? input.services
        : input.services.filter((service) =>
            section.body.toUpperCase().includes((service.discipline ?? "").toUpperCase()),
          );
    // Prompt 18, itens 19 e 20 — a resolução de overrides deixou de estar
    // duplicada aqui: é a função central do `portfolio`, aplicada por serviço.
    const images = related
      .flatMap((service) => imagesForService(input.portfolio ?? [], service, input.portfolioOverrides))
      .slice(0, 3);
    return {
      key: section.key,
      title: section.title,
      body: section.body,
      origin: section.origin,
      evidence: section.evidence,
      images,
    };
  });

  const servicesBlock = input.services
    .map(
      (service) =>
        `- ${service.name}: ${service.quantity ?? 1} ${service.unit ?? "un."} — ${formatCurrencyBRL(Number(service.subtotal ?? 0))}`,
    )
    .join("\n");

  const values: Record<string, string | number | null | undefined> = {
    CLIENTE_NOME: input.client.fullName ?? input.client.name,
    PROJETO_NOME: input.project.name,
    PROJETO_DESCRICAO: input.project.description,
    SERVICOS: servicesBlock || null,
    VALOR_TOTAL: formatCurrencyBRL(input.pricing.total),
    PARCELAS: paymentCondition,
    CRONOGRAMA: scheduleSummary,
    VALIDADE: input.validityDays ? `${input.validityDays} dias` : null,
  };

  const formal = renderTemplate(
    [
      `PROPOSTA COMERCIAL — ${input.project.name}`,
      "",
      `Cliente: ${values.CLIENTE_NOME}`,
      "",
      "SERVIÇOS CONTRATADOS",
      values.SERVICOS ?? "",
      "",
      `Valor total: ${values.VALOR_TOTAL}`,
      paymentCondition ? `Condição de pagamento: ${paymentCondition}` : null,
      scheduleSummary ? `Cronograma: ${scheduleSummary}` : null,
      input.validityDays ? `Validade: ${input.validityDays} dias` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    values,
  );

  if (formal.missing.length) {
    warnings.push(`Variáveis sem valor no documento formal: ${formal.missing.join(", ")}.`);
  }

  return {
    fingerprint: fingerprintOf(input),
    generatedFrom: { proposalId: input.proposal.id, version: input.proposal.version, status: input.proposal.status },
    clientName: input.client.fullName ?? input.client.name,
    projectName: input.project.name,
    narrative,
    slides,
    schedule,
    totals: {
      subtotal: input.pricing.subtotal,
      adjustment: input.pricing.adjustment ?? 0,
      total: input.pricing.total,
      currency: "BRL",
    },
    services: input.services,
    paymentPlan: input.paymentPlan ?? [],
    formalText: formal.text,
    warnings: [...new Set(warnings)],
  };
}

/**
 * Impressão digital dos dados que produziram o documento (Tópico 40).
 *
 * Não é criptografia: é a prova de que a versão exibida ao cliente vem
 * exatamente destes dados. Duas passadas de FNV-1a — estável e sem trazer
 * dependência nova ao projeto.
 */
export function fingerprintOf(input: GeneratorInput): string {
  const canonical = JSON.stringify({
    proposalId: input.proposal.id,
    version: input.proposal.version,
    client: input.client.fullName ?? input.client.name,
    project: input.project.name,
    services: input.services.map((s) => [s.name, s.quantity ?? 1, s.subtotal ?? 0]),
    total: input.pricing.total,
    plan: (input.paymentPlan ?? []).map((line) => [line.label, line.percent, line.amount]),
    overrides: Object.keys(input.portfolioOverrides ?? {}).sort(),
  });

  let first = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    first ^= canonical.charCodeAt(index);
    first = Math.imul(first, 0x01000193) >>> 0;
  }
  let second = 0x9dc5811c;
  for (let index = canonical.length - 1; index >= 0; index -= 1) {
    second ^= canonical.charCodeAt(index);
    second = Math.imul(second, 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}

/** Estrutura canónica das secções, exposta para a interface. */
export const GENERATED_SECTION_ORDER = NARRATIVE_SECTIONS.map((section) => ({
  key: section.key,
  title: section.title,
}));

