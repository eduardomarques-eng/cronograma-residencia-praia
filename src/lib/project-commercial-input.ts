import { normalizeDiscipline, type Discipline } from "./commercial-scope";

/**
 * FASE 4C — O INPUT COMERCIAL DO PROJETO (`PROJECT_COMMERCIAL_INPUT`).
 *
 * Este módulo materializa a regra fundamental da fase:
 *
 *   A proposta NÃO nasce de um formulário comercial vazio. Ela nasce do projeto.
 *
 * Antes do preenchimento, `Project` e `Briefing` são fatos técnicos: o que foi
 * identificado no imóvel e o que o cliente declarou. Este módulo traduz esses
 * fatos em SUGESTÕES comerciais — e é deliberadamente uma TRADUÇÃO, não uma
 * cópia: não cria cadastro, não duplica cliente e não inventa serviço.
 *
 * Duas garantias estruturais:
 *
 *  1. **Nada é inventado.** Cada valor Suggestido carrega `evidence` — a chave
 *     exacta do briefing de onde veio. Se não há dado, não há sugestão.
 *     Inventar "6 ambientes" fabricaria um número que o cliente leria como
 *     compromisso.
 *
 *  2. **Sugestão não é contratação.** `suggestServices` marca tudo com `reason`
 *     e o ADMIN decide. Nada é somado ao total nem enviado sem decisão comercial
 *     explícita — é o item 4 ("não inventar serviços apenas porque existem no
 *     catálogo") e o item 14 ("não incluir automaticamente porque apareceu no
 *     briefing").
 */

/** Uma resposta do briefing, com a origem preservada. */
export type CommercialEvidence = {
  /** Chave exacta em `Briefing.responses`. */
  key: string;
  /** Rótulo legível para o ADMIN conferir a origem. */
  label: string;
  /** Valor já normalizado para texto. */
  value: string;
};

export type ProjectCommercialInput = {
  /** Identificação. Vem do cadastro — nunca é recriado aqui. */
  client: { id: string; name: string; fullName: string | null; email: string | null; phone: string | null };
  project: {
    id: string;
    name: string;
    type: string | null;
    description: string | null;
    scope: string | null;
    /** Área declarada, apenas como texto ("180 m²"). Nunca convertida aqui. */
    area: string | null;
    /** Ambientes citados no briefing, normalizados e deduplicados. */
    environments: string[];
    /** Disciplinas técnicas presentes no projeto. */
    disciplines: Discipline[];
    /** Complexidade declarada pelo ADMIN, quando existe. */
    complexity: string | null;
    requirements: string[];
    restrictions: string[];
    notes: string | null;
  };
  /** Briefing disponível? Ausente significa prefill mais pobre, não erro. */
  briefingStatus: "FINALIZED" | "DRAFT" | null;
  evidence: CommercialEvidence[];
};

/** Entrada mínima. Estreita de propósito: quem chama já filtrou. */
export type ProjectCommercialInputSource = {
  client: { id: string; name: string; fullName?: string | null; email?: string | null; phone?: string | null };
  project: {
    id: string;
    name: string;
    type?: string | null;
    description?: string | null;
    scope?: string | null;
    notes?: string | null;
  };
  briefing?: { responses?: unknown; status?: "DRAFT" | "FINALIZED" } | null;
};
/* -------------------------------------------------------------------------- */
/* Leitura das respostas do briefing                                         */
/* -------------------------------------------------------------------------- */

/**
 * As chaves abaixo são as do `briefing-definition.ts` vigente. São declaradas
 * como CONSTANTES, e não como expressões regulares soltas, para que quando o
 * briefing mudar o compilador aponte o ponto exacto a actualizar em vez de a
 * extração passar a devolver nada em silêncio.
 */
export const BRIEFING_KEYS = {
  areaBuilt: "p4_area_construida",
  areaLand: "p4_area_terreno",
  environments: "p8_ambientes",
  environmentsAlt: "p3_ambientes",
  why: "p3_porque_agora",
  problem: "p3_problema",
  change: "p3_mudar",
  notWanted: "p3_nao_quero",
  daily: "p3_dia_a_dia",
  accessibility: "p1_acessibilidade",
  indispensable: "p3_indispensaveis",
  priorities: "p3_prioridade_objetivo",
  nature: "p2_natureza",
  propertyAge: "p4_idade_imovel",
  condominium: "p2_condominio",
  serviceType: "p8_servico",
  storage: "p3_armazenamento",
  distribution: "p3_distribuicao",
  lighting: "p9_luz",
  automation: "p9_automacao",
} as const;

/** Campos cujo texto é um requisito ou necessidade especial. */
const REQUIREMENT_KEYS = [BRIEFING_KEYS.accessibility, BRIEFING_KEYS.indispensable, BRIEFING_KEYS.automation] as const;
/** Campos cujo texto é uma restrição declarada pelo cliente. */
const RESTRICTION_KEYS = [BRIEFING_KEYS.notWanted] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Extrai texto de uma resposta do briefing.
 *
 * As respostas não são todas strings: podem ser número, lista ou objeto com
 * `value`/`label`. Esta função achata os formatos CONHECIDOS e devolve `null`
 * para o que não reconhece — em vez de imprimir `[object Object]` na proposta.
 */
export function readBriefingText(responses: Record<string, unknown>, key: string): string | null {
  const raw = responses[key];
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "string") return raw.trim() || null;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "boolean") return raw ? "sim" : null;

  if (Array.isArray(raw)) {
    const parts = raw
      .map((entry) => {
        if (typeof entry === "string") return entry.trim();
        if (typeof entry === "number") return String(entry);
        const record = asRecord(entry);
        const label = record.label ?? record.value ?? record.title;
        return typeof label === "string" ? label.trim() : "";
      })
      .filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  const record = asRecord(raw);
  const label = record.label ?? record.value ?? record.text ?? record.answer;
  return typeof label === "string" ? label.trim() || null : null;
}
/**
 * Ambientes citados, como lista, com a contagem quando o cliente a informou.
 *
 * Lê PRIMEIRO o formato estruturado (`[{ questionId, kind, value }]`, que é o
 * que o formulário produz hoje) e só depois o texto livre.
 *
 * O marcador `QUANTIDADE` merece explicação: quando o cliente diz "são 6
 * ambientes", o formulário não conhece os nomes, só o número. Traduzir "6" numa
 * lista de seis ambientes inventados seria fabricar conteúdo. Por isso devolvemos
 * a CONTAGEM separada da lista, e o consumidor usa a contagem como sugestão de
 * quantidade — nunca como lista de nomes.
 */
export function readBriefingEnvironments(responses: Record<string, unknown>): {
  environments: string[];
  quantity: number | null;
} {
  const candidates = [BRIEFING_KEYS.environments, BRIEFING_KEYS.environmentsAlt];
  for (const key of candidates) {
    const raw = responses[key];
    if (!Array.isArray(raw) || raw.length === 0) continue;

    const names: string[] = [];
    let quantity: number | null = null;

    for (const entry of raw) {
      const record = asRecord(entry);
      const value = record.value;
      if (typeof value !== "string" || !value.trim()) continue;
      const normalized = value.trim();
      if (normalized.toUpperCase() === "QUANTIDADE") {
        const asked = Number(record.askedCount ?? record.count ?? NaN);
        if (Number.isFinite(asked) && asked > 0) quantity = asked;
        continue;
      }
      if (!names.includes(normalized)) names.push(normalized);
    }

    if (names.length || quantity !== null) return { environments: names, quantity };
  }

  // Formato texto livre: "sala, cozinha e banheiro" → três ambientes.
  for (const key of candidates) {
    const text = readBriefingText(responses, key);
    if (!text) continue;
    const parts = text
      .split(/[,;/]| e /i)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);
    if (parts.length > 1) return { environments: [...new Set(parts)], quantity: parts.length };
  }

  return { environments: [], quantity: null };
}

/**
 * Áreas do projeto, em texto, com a origem identificada.
 *
 * O valor NÃO é convertido para número: "180 m²" pode ser área construída, área
 * de terreno, ou um intervalo. Quem multiplica por preço é o motor de preços, e
 * ele exige um número explícito escrito pelo ADMIN — nunca um número que este
 * módulo adivinhou a partir de uma frase.
 */
/**
 * Disciplinas presentes, derivadas do que o briefing e o projeto descrevem.
 *
 * Mapeamento EXPLÍCITO e conservador: cada chave do briefing aponta para as
 * disciplinas que ela de facto implica. Um mapeamento genérico geraria
 * "INTERIORES" a partir de qualquer menção a cozinha — e o item 15 proíbe
 * exactamente isso (hidrossanitário aparecer no briefing não significa
 * contratação; é uma decisão comercial do ADMIN).
 */
const BRIEFING_DISCIPLINE_HINTS: ReadonlyArray<{ key: string; disciplines: Discipline[] }> = [
  { key: BRIEFING_KEYS.serviceType, disciplines: ["INTERIORES"] },
  { key: BRIEFING_KEYS.nature, disciplines: ["ARQUITETURA"] },
  { key: BRIEFING_KEYS.condominium, disciplines: ["ARQUITETURA"] },
  { key: BRIEFING_KEYS.lighting, disciplines: ["3D_RENDER"] },
];

/**
 * Constrói o input comercial do projeto.
 *
 * Puro e determinístico: mesmas entradas, mesma saída. Sem relógio, sem
 * aleatoriedade, sem leitura de banco. É por isso que a função é testável sem
 * infraestrutura — e por isso que o prefill é auditável.
 */
export function buildProjectCommercialInput(source: ProjectCommercialInputSource): ProjectCommercialInput {
  const responses = asRecord(source.briefing?.responses);
  const evidence: CommercialEvidence[] = [];

  /** Regista um valor e a sua origem, se existir. */
  const push = (key: string, label: string, value: string | null) => {
    if (value) evidence.push({ key, label, value });
    return value;
  };

  const areas = readAreas(responses);
  for (const [index, area] of areas.entries()) {
    const key = index === 0 ? BRIEFING_KEYS.areaBuilt : BRIEFING_KEYS.areaLand;
    push(key, index === 0 ? "Área construída" : "Área de terreno", area);
  }

  const { environments, quantity: environmentCount } = readBriefingEnvironments(responses);
  // A contagem só entra como EVIDÊNCIA quando o cliente informou um número. Ela
  // nunca vira quantidade de cobrança sozinha: o ADMIN escolhe no editor e o
  // motor valida contra o mínimo/máximo do catálogo (item 12).
  if (environmentCount !== null) {
    evidence.push({
      key: BRIEFING_KEYS.environments,
      label: "Ambientes informados pelo cliente",
      value: `${environmentCount} ambiente(s)`,
    });
  }

  const requirements = collectTexts(responses, REQUIREMENT_KEYS);
  for (const [index, text] of requirements.entries()) {
    push(REQUIREMENT_KEYS[index]!, "Requisito declarado", text);
  }
  const restrictions = collectTexts(responses, RESTRICTION_KEYS);
  for (const text of restrictions) push(BRIEFING_KEYS.notWanted, "Restrição declarada", text);

  // Disciplinas: as do próprio projeto (tipo/descrição/escopo) + as do briefing.
  const disciplines = new Set<Discipline>();
  for (const raw of [source.project.type, source.project.description, source.project.scope]) {
    const normalized = normalizeDiscipline(raw);
    if (normalized) disciplines.add(normalized);
  }
  for (const hint of BRIEFING_DISCIPLINE_HINTS) {
    if (!readBriefingText(responses, hint.key)) continue;
    for (const discipline of hint.disciplines) disciplines.add(discipline);
  }

  return {
    client: {
      id: source.client.id,
      name: source.client.name,
      fullName: source.client.fullName ?? null,
      email: source.client.email ?? null,
      phone: source.client.phone ?? null,
    },
    project: {
      id: source.project.id,
      name: source.project.name,
      type: source.project.type ?? null,
      description: source.project.description ?? null,
      scope: source.project.scope ?? null,
      area: areas[0] ?? null,
      environments,
      disciplines: [...disciplines],
      // `Project` não tem coluna de complexidade. Declaramos `null` em vez de
      // inferir de "residência grande": o item 23 manda usar a configuração
      // comercial vigente, e inferir seria inventar faixa de preço.
      complexity: null,
      requirements,
      restrictions,
      notes: source.project.notes ?? null,
    },
    briefingStatus: source.briefing?.status ?? null,
    evidence,
  };
}
function readAreas(responses: Record<string, unknown>): string[] {
  const areas: string[] = [];
  for (const key of [BRIEFING_KEYS.areaBuilt, BRIEFING_KEYS.areaLand]) {
    const text = readBriefingText(responses, key);
    if (text && !areas.includes(text)) areas.push(text);
  }
  return areas;
}
/* -------------------------------------------------------------------------- */
/* Sugestões de serviço a partir do catálogo                                  */
/* -------------------------------------------------------------------------- */

export type SuggestedService = {
  serviceId: string;
  name: string;
  discipline: string;
  unit: string;
  /** Preço do nível BASE (Médio). Referência; não é o valor final. */
  basePrice: number;
  minPrice: number | null;
  estimatedDays: number | null;
  /** Quantidade SUGERIDA e de onde vem — nunca aplicada sozinha. */
  suggestedQuantity: number | null;
  /** Por que este serviço apareceu. Auditável. */
  reason: string;
};

/**
 * Serviço do catálogo tal como a sugestão precisa de ver.
 *
 * `minPrice` e `estimatedDays` aceitam `undefined` porque `CatalogService` (o
 * tipo do motor de preços) usa `?:` e o registo real do Prisma pode devolver
 * `null`. Aceitar os três estados evita um `as` no chamador — e um `as` aqui
 * esconderia exactamente o erro que o item 13 quer ver: um serviço sem preço.
 */
export type SuggestableService = {
  id: string;
  name: string;
  discipline: string;
  unit: string;
  baseMedium: number;
  minPrice?: number | null;
  estimatedDays?: number | null;
  active?: boolean;
};

/**
 * Sugere serviços do catálogo cujas disciplinas aparecem no projeto.
 *
 * Regra deliberada: sugerir NÃO é incluir. Um serviço só entra na sugestão se:
 *
 *  · a disciplina dele estiver presente no projeto; E
 *  · o preço existir no nível consultado.
 *
 * Um serviço sem preço cadastrado NÃO é sugerido. Mostrar "Interiores" com
 * "valor a definir" empurraria o ADMIN a inventar o número — que é exactamente o
 * que os itens 13 e 23 proíbem.
 *
 * A quantidade sugerida só aparece quando há base factual: a contagem de
 * ambientes informada pelo cliente, e apenas para serviços cobrados por ambiente
 * (item 12). Para m² não sugerimos quantidade, porque converter "180 m²" num
 * multiplicador seria fabricar uma medição.
 */
export function suggestServices(input: {
  catalog: ReadonlyArray<SuggestableService>;
  project: Pick<ProjectCommercialInput["project"], "disciplines" | "environments">;
  environmentCount: number | null;
  levelPrice?: (service: SuggestableService) => number | null;
}): SuggestedService[] {
  const disciplines = new Set(input.project.disciplines);
  const suggestions: SuggestedService[] = [];

  for (const service of input.catalog) {
    if (service.active === false) continue;
    const discipline = normalizeDiscipline(service.discipline);
    if (!discipline || !disciplines.has(discipline)) continue;

    const price = (input.levelPrice?.(service) ?? service.baseMedium) || 0;
    if (!(price > 0)) continue;

    const suggestedQuantity =
      discipline === "INTERIORES" && service.unit === "AMBIENTE" && input.environmentCount !== null
        ? input.environmentCount
        : null;

    suggestions.push({
      serviceId: service.id,
      name: service.name,
      discipline,
      unit: service.unit,
      basePrice: price,
      minPrice: service.minPrice ?? null,
      estimatedDays: service.estimatedDays ?? null,
      suggestedQuantity,
      reason:
        suggestedQuantity !== null
          ? `Disciplina ${discipline} presente no projeto; quantidade ${suggestedQuantity} ambiente(s) informada pelo cliente.`
          : `Disciplina ${discipline} presente no projeto. Confirme a quantidade antes de salvar.`,
    });
  }

  return suggestions;
}

/** Coleta os textos não vazios e sem repetição de uma lista de chaves. */
function collectTexts(responses: Record<string, unknown>, keys: readonly string[]): string[] {
  const found: string[] = [];
  for (const key of keys) {
    const text = readBriefingText(responses, key);
    if (text && !found.includes(text)) found.push(text);
  }
  return found;
}