import { extractDisciplines } from "./commercial-scope";
import { NARRATIVE_SECTIONS, type NarrativeSectionKey } from "./template-registry";

/**
 * Tópico 43 — narrativa comercial da proposta.
 *
 * Regras duras aplicadas aqui:
 *  · cada frase é derivada de um dado existente (briefing, serviços, valores);
 *  · nada de promessa exagerada, urgência artificial, contador falso ou pressão;
 *  · quando o dado não existe, a secção é omitida em vez de preenchida com
 *    texto genérico — o que o Tópico 43 proíbe explicitamente.
 *
 * Determinístico: mesmas entradas, mesma saída, sem relógio ou aleatoriedade.
 */

export type NarrativeOrigin =
  | "BRIEFING"
  | "SERVICOS_CONTRATADOS"
  | "PROPOSTA_APROVADA"
  | "CRONOGRAMA"
  | "CONFIGURACAO";

export type NarrativeSection = {
  key: NarrativeSectionKey;
  title: string;
  body: string;
  origin: NarrativeOrigin;
  /** Campos concretos que sustentam a frase — torna a afirmação auditável. */
  evidence: string[];
};

export type NarrativeInput = {
  clientName?: string | null;
  projectName?: string | null;
  projectDescription?: string | null;
  briefingResponses?: Record<string, unknown> | null;
  services?: ReadonlyArray<Record<string, unknown>>;
  total?: number | null;
  paymentCondition?: string | null;
  scheduleSummary?: string | null;
  /** Passo seguinte definido pelo ADMIN; nunca gerado pelo sistema. */
  nextStep?: string | null;
  validityDays?: number | null;
};

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function sentences(values: ReadonlyArray<string | null | undefined>): string[] {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toLowerCase() + trimmed.slice(1);
}

function formatBRL(value: number): string {
  const [integer, decimals] = value.toFixed(2).split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimals}`;
}

/**
 * Monta a narrativa completa. Devolve apenas as secções com conteúdo real:
 * uma secção sem dado é omitida, nunca preenchida com frase genérica.
 */
export function buildCommercialNarrative(input: NarrativeInput): NarrativeSection[] {
  const responses = input.briefingResponses ?? {};
  const services = input.services ?? [];
  const sections = new Map<NarrativeSectionKey, NarrativeSection>();

  const set = (
    key: NarrativeSectionKey,
    bodyParts: Array<string | null | undefined>,
    origin: NarrativeOrigin,
    evidence: string[],
  ) => {
    const list = sentences(bodyParts);
    if (!list.length) return;
    const meta = NARRATIVE_SECTIONS.find((section) => section.key === key);
    sections.set(key, {
      key,
      title: meta?.title ?? key,
      body: list.join(" "),
      origin,
      evidence: evidence.filter(Boolean),
    });
  };

  // 1. O projeto do cliente — identifica o que é, sem adjetivos vagos.
  const area = text(responses.area ?? responses.areaTotal ?? responses.metragem);
  const nature = text(responses.p2_natureza);
  set(
    "CLIENT_PROJECT",
    [
      input.projectDescription
        ? `O projeto “${input.projectName}” parte de ${lowerFirst(input.projectDescription)}.`
        : null,
      input.projectName ? `O escopo foi construído a partir do briefing registrado por ${input.clientName}.` : null,
      area ? `A área de referência informada é de ${area}.` : null,
      nature ? `O ponto de partida é ${lowerFirst(nature)}.` : null,
    ],
    "BRIEFING",
    [input.projectName, area, nature].filter(Boolean) as string[],
  );

  // 2. O que foi identificado — o que o briefing efectivamente diz.
  const environments = Array.isArray(responses.rooms)
    ? responses.rooms.filter((room): room is string => typeof room === "string" && Boolean(room.trim()))
    : [];
  const indispensable = text(responses.p3_indispensaveis);
  const style = text(responses.p4_estilos);
  set(
    "IDENTIFIED",
    [
      environments.length ? `O briefing aponta os ambientes: ${environments.join(", ")}.` : null,
      indispensable ? `Foram registrados como indispensáveis ${lowerFirst(indispensable)}.` : null,
      style ? `A direção estética parte de ${lowerFirst(style)}.` : null,
    ],
    "BRIEFING",
    [environments.join(", "), indispensable, style].filter(Boolean) as string[],
  );

  // 3. Como a ArqVértice irá trabalhar — derivado das disciplinas contratadas.
  const disciplines = extractDisciplines(services);
  set(
    "APPROACH",
    [
      disciplines.length ? `O trabalho será conduzido nas disciplinas contratadas: ${disciplines.join(", ")}.` : null,
      disciplines.length ? "Cada disciplina é conduzida dentro do escopo registrado nesta proposta." : null,
    ],
    "SERVICOS_CONTRATADOS",
    disciplines,
  );

  // 4. O que será entregue — a lista real, sem prometer além dela.
  const deliverableNames = services
    .map((service) => text(service.name))
    .filter((value): value is string => Boolean(value));
  set(
    "DELIVERABLES",
    [
      deliverableNames.length
        ? `A entrega compreende ${deliverableNames.length === 1 ? "o serviço de " : "os serviços de "}${deliverableNames.join(", ")}.`
        : null,
      deliverableNames.length ? "Itens fora desta lista não estão incluídos nesta proposta." : null,
    ],
    "SERVICOS_CONTRATADOS",
    deliverableNames,
  );

  // 5. Como o processo acontecerá — apenas se o cronograma foi calculado.
  set(
    "PROCESS",
    [input.scheduleSummary ? `O cronograma previsto é ${lowerFirst(input.scheduleSummary)}.` : null],
    "CRONOGRAMA",
    input.scheduleSummary ? [input.scheduleSummary] : [],
  );

  // 6. O investimento — números reais, sem desconto inventado.
  set(
    "INVESTMENT",
    [
      input.total != null && input.total > 0 ? `O investimento total é de R$ ${formatBRL(input.total)}.` : null,
      input.paymentCondition ? `A condição de pagamento aprovada é: ${lowerFirst(input.paymentCondition)}.` : null,
    ],
    "PROPOSTA_APROVADA",
    [input.total != null ? String(input.total) : "", input.paymentCondition].filter(Boolean) as string[],
  );

  // 7. O que acontece após a aprovação — passo definido pelo ADMIN, nunca gerado.
  set(
    "AFTER_APPROVAL",
    [
      input.nextStep ? `Após a aprovação, o próximo passo é: ${lowerFirst(input.nextStep)}.` : null,
      input.validityDays ? `Esta proposta é válida por ${input.validityDays} dias a partir da data de envio.` : null,
    ],
    "CONFIGURACAO",
    [input.nextStep, input.validityDays ? String(input.validityDays) : ""].filter(Boolean) as string[],
  );

  // A ordem do Tópico 43 é a ordem de leitura, não a de construção.
  return NARRATIVE_SECTIONS.map((section) => sections.get(section.key)).filter(
    (section): section is NarrativeSection => Boolean(section),
  );
}

