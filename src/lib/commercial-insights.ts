import { extractDisciplines, type Discipline } from "./commercial-scope";

/** Tópico 30 — origem de cada recomendação. Sempre exibida ao ADMIN. */
export type InsightOrigin =
  | "BRIEFING"
  | "SERVICOS_CONTRATADOS"
  | "PROPOSTA_APROVADA"
  | "CATALOGO"
  | "CONFIGURACAO";

export type Insight = {
  code: string;
  label: string;
  detail: string;
  origin: InsightOrigin;
  originRef: string;
  /** Recomendações nunca aplicam sozinhas: exigem autorização do ADMIN. */
  requiresAdminApproval: boolean;
};

export type InsightInput = {
  briefingResponses?: Record<string, unknown> | null;
  services?: ReadonlyArray<Record<string, unknown>>;
  packages?: ReadonlyArray<{ name: string; disciplines: readonly string[] }>;
  contractScopeReason?: string | null;
  contractScopeMatched?: readonly string[];
};

const COMPLEMENTARY_HINTS: ReadonlyArray<{ discipline: Discipline; reason: string }> = [
  { discipline: "ESTRUTURAL", reason: "Projeto de arquitetura sem disciplina estrutural contratada." },
  { discipline: "COMPLEMENTARES", reason: "Projeto de arquitetura sem Complementares contratados." },
  { discipline: "3D_RENDER", reason: "Projeto sem serviço de 3D/Render contratado." },
  { discipline: "INTERIORES", reason: "Projeto sem Interiores contratados." },
];

function asText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Tópico 30 — automação inteligente e determinística. As recomendações só
 * apontam para dados já existentes no sistema e sempre carregam a origem.
 * Nenhum valor, escopo, prazo ou serviço é inventado aqui.
 */
export function deriveCommercialInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const responses = input.briefingResponses ?? {};
  const services = input.services ?? [];

  const area = asText(responses.area ?? responses.areaTotal ?? responses.metragem);
  if (area) {
    insights.push({
      code: "AREA_DETECTED",
      label: "Área identificada",
      detail: `O briefing informa ${area}.`,
      origin: "BRIEFING",
      originRef: "briefing.responses",
      requiresAdminApproval: false,
    });
  }

  const rooms = Array.isArray(responses.rooms) ? responses.rooms.filter((room): room is string => typeof room === "string") : [];
  if (rooms.length) {
    insights.push({
      code: "ROOMS_DETECTED",
      label: "Ambientes identificados",
      detail: `Ambientes citados no briefing: ${rooms.join(", ")}.`,
      origin: "BRIEFING",
      originRef: "briefing.responses.rooms",
      requiresAdminApproval: false,
    });
  }

  const disciplines = extractDisciplines(services);
  if (disciplines.length) {
    insights.push({
      code: "SERVICES_SUMMARY",
      label: "Serviços contratados",
      detail: `Disciplinas na proposta aprovada: ${disciplines.join(", ")}.`,
      origin: "SERVICOS_CONTRATADOS",
      originRef: "ProposalVersion.services",
      requiresAdminApproval: false,
    });
  }

  for (const hint of COMPLEMENTARY_HINTS) {
    if (disciplines.includes("ARQUITETURA") && !disciplines.includes(hint.discipline)) {
      insights.push({
        code: "SUGGEST_COMPLEMENTARY",
        label: `Sugestão: ${hint.discipline}`,
        detail: hint.reason,
        origin: "SERVICOS_CONTRATADOS",
        originRef: "ProposalVersion.services",
        requiresAdminApproval: true,
      });
    }
  }

  for (const pack of input.packages ?? []) {
    const covered = pack.disciplines.every((discipline) => disciplines.includes(discipline as Discipline));
    if (covered && pack.disciplines.length > 0) {
      insights.push({
        code: "PACKAGE_MATCH",
        label: `Pacote correspondente: ${pack.name}`,
        detail: `O pacote “${pack.name}” do catálogo cobre as disciplinas contratadas.`,
        origin: "CATALOGO",
        originRef: `package:${pack.name}`,
        requiresAdminApproval: true,
      });
    }
  }

  if (input.contractScopeReason) {
    insights.push({
      code: "CONTRACT_SCOPE",
      label: "Escopo do contrato",
      detail: input.contractScopeReason,
      origin: "CONFIGURACAO",
      originRef: (input.contractScopeMatched ?? []).join(", ") || "sem disciplina",
      requiresAdminApproval: false,
    });
  }

  return insights;
}