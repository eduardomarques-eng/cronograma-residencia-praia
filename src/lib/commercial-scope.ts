export const DISCIPLINES = [
  "ARQUITETURA",
  "ESTRUTURAL",
  "3D_RENDER",
  "COMPLEMENTARES",
  "INTERIORES",
] as const;

export type Discipline = (typeof DISCIPLINES)[number];

const ALIASES: Record<string, Discipline> = {
  ARQ: "ARQUITETURA",
  ARQUITETONICO: "ARQUITETURA",
  ESTRUTURA: "ESTRUTURAL",
  ESTRUTURAS: "ESTRUTURAL",
  "3D": "3D_RENDER",
  RENDER: "3D_RENDER",
  IMAGENS: "3D_RENDER",
  COMPLEMENTAR: "COMPLEMENTARES",
  ELETRICO: "COMPLEMENTARES",
  HIDROSSANITARIO: "COMPLEMENTARES",
  INTERIOR: "INTERIORES",
};

/** Normaliza rótulos livres do ADMIN para as disciplinas canônicas. */
export function normalizeDiscipline(value: unknown): Discipline | null {
  if (typeof value !== "string") return null;
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const direct = DISCIPLINES.find((discipline) => discipline === key);
  return direct ?? ALIASES[key] ?? null;
}

/** Extrai as disciplinas efetivamente contratadas a partir dos serviços. */
export function extractDisciplines(services: ReadonlyArray<Record<string, unknown>>): Discipline[] {
  const found = new Set<Discipline>();
  for (const service of services) {
    const discipline = normalizeDiscipline(service.discipline ?? service.disciplina ?? service.category);
    if (discipline) found.add(discipline);
  }
  return [...found];
}

export type ContractTemplateScope = {
  id: string;
  scopeKey: string | null;
  disciplines: string[];
  isDefault: boolean;
};

export type TemplateSelection<T> = {
  template: T | null;
  matched: Discipline[];
  /** Tópico 30: a origem da escolha é sempre explicitada. */
  reason: string;
};

/**
 * Tópico 26: escolhe o contrato mais específico cujo escopo está contido nos
 * serviços efetivamente contratados; sem correspondência, usa o padrão.
 */
export function selectContractTemplateForScope<T extends ContractTemplateScope>(
  templates: readonly T[],
  services: ReadonlyArray<Record<string, unknown>>,
): TemplateSelection<T> {
  const contracted = extractDisciplines(services);
  const ranked = templates
    .map((template) => {
      const required = Array.from(
        new Set(template.disciplines.map(normalizeDiscipline).filter((value): value is Discipline => Boolean(value))),
      );
      const applicable = required.length > 0 && required.every((value) => contracted.includes(value));
      return { template, required, applicable };
    })
    .filter((candidate) => candidate.applicable)
    .sort(
      (a, b) =>
        b.required.length - a.required.length ||
        Number(Boolean(b.template.isDefault)) - Number(Boolean(a.template.isDefault)),
    );

  const chosen = ranked[0];
  if (chosen) {
    return {
      template: chosen.template,
      matched: contracted,
      reason: `Escopo específico ${chosen.required.join(" + ")}: todos os serviços contratados estão cobertos.`,
    };
  }

  const fallback = templates.find((template) => template.isDefault) ?? templates[0] ?? null;
  if (!fallback) return { template: null, matched: contracted, reason: "Nenhum template contratual ativo." };
  return {
    template: fallback,
    matched: contracted,
    reason:
      contracted.length === 0
        ? "Template padrão: os serviços da proposta ainda não têm disciplina identificada."
        : "Template padrão: nenhum template cobre exatamente o escopo contratado.",
  };
}