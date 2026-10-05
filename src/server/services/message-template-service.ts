import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import { NOTIFICATION_CHANNEL, type NotificationChannel } from "@/lib/commercial-events";
import { findTemplateByKey } from "@/lib/template-registry";
import { extractTemplateKeys, renderTemplate } from "@/lib/template-engine";

export async function listMessageTemplates() {
  await requireRole("ADMIN");
  return prisma.messageTemplate.findMany({ orderBy: [{ channel: "asc" }, { key: "asc" }] });
}

/**
 * Prompt 19, item 4 — RESOLUÇÃO CENTRAL DE TEMPLATES.
 *
 * Único caminho entre o código e o conteúdo: carrega do banco, valida as
 * variáveis e devolve o texto pronto. Nenhum consumidor monta a mensagem por
 * conta própria.
 *
 * Detecta e distingue, como o item 4 exige:
 *  · template inexistente  → `inexistente`
 *  · template inativo      → `inativo`
 *  · variável obrigatória ausente → `obrigatoria_ausente`
 *  · variável não declarada no contrato → `nao_permitida`
 *
 * O texto NUNCA é enviado com `{{PLACEHOLDER}}` por resolver: ou a variável
 * tem valor, ou o envio é recusado com um erro que o ADMIN consegue corrigir.
 */
export type TemplateResolutionFailure =
  | "inexistente"
  | "inativo"
  | "obrigatoria_ausente"
  | "nao_permitida";

export type ResolvedTemplate = {
  ok: true;
  key: string;
  text: string;
  version: number;
  /** Variáveis efectivamente substituídas. */
  used: string[];
};

export type TemplateResolutionError = {
  ok: false;
  key: string;
  reason: TemplateResolutionFailure;
  /** Detalhe legível para o ADMIN: o que corrigir. */
  message: string;
  missing: string[];
};

export type TemplateResolution = ResolvedTemplate | TemplateResolutionError;

/**
 * Carrega e valida um template do banco.
 *
 * `variables` é o contrato declarado em `template-registry`; os valores são os
 * que o consumidor tem. Não há fallback de texto em código: se o template não
 * existir, o ADMIN tem de o criar — e a mensagem diz exactamente isso.
 */
export async function resolveTemplate(
  key: string,
  variables: Record<string, string | number | null | undefined>,
  options: { blockOnMissing?: boolean } = {},
): Promise<TemplateResolution> {
  const record = await prisma.messageTemplate.findUnique({ where: { key } });

  if (!record) {
    return {
      ok: false,
      key,
      reason: "inexistente",
      message: `O template “${key}” não existe. Crie-o em Mensagens antes de enviar.`,
      missing: [],
    };
  }
  if (!record.active) {
    return {
      ok: false,
      key,
      reason: "inativo",
      message: `O template “${key}” está inativo. Ative-o em Mensagens antes de enviar.`,
      missing: [],
    };
  }

  const definition = findTemplateByKey(key);
  const declared = new Set((definition?.variables ?? []).map((variable) => variable.key));
  const required = new Set(
    (definition?.variables ?? []).filter((variable) => variable.required).map((variable) => variable.key),
  );
  const blockOnMissing = options.blockOnMissing ?? definition?.blockOnMissing ?? false;

  // Variável presente no corpo mas ausente dos valores fornecidos.
  const referenced = extractTemplateKeys(record.body);
  const supplied = new Set(Object.keys(variables).map((key) => key.trim().toUpperCase()));
  const missing = referenced.filter((name) => {
    const value = variables[name];
    return value === undefined || value === null || String(value).trim() === "";
  });

  if (blockOnMissing) {
    const missingRequired = [...required].filter((name) => {
      const value = variables[name];
      return value === undefined || value === null || String(value).trim() === "";
    });
    if (missingRequired.length) {
      return {
        ok: false,
        key,
        reason: "obrigatoria_ausente",
        message: `Template “${key}” incompleto: variáveis obrigatórias ausentes ${missingRequired.join(", ")}.`,
        missing: missingRequired,
      };
    }
  }

  // Um contrato declarado rejeita variáveis que o template não conhece: é o
  // sinal de que o consumidor e o template divergiram.
  if (definition && declared.size) {
    const naoPermitidas = [...supplied].filter((name) => !declared.has(name));
    if (naoPermitidas.length) {
      return {
        ok: false,
        key,
        reason: "nao_permitida",
        message: `Template “${key}” não aceita as variáveis ${naoPermitidas.join(", ")}.`,
        missing: naoPermitidas,
      };
    }
  }

  const rendered = renderTemplate(record.body, variables);
  // Nenhum placeholder sobrevive quando o template é bloqueante: o item 4
  // proíbe enviar com `{{PLACEHOLDER}}` por resolver.
  const unresolved = extractTemplateKeys(rendered.text);
  if (blockOnMissing && unresolved.length) {
    return {
      ok: false,
      key,
      reason: "obrigatoria_ausente",
      message: `Template “${key}” ficou com variáveis por resolver: ${unresolved.join(", ")}.`,
      missing: unresolved,
    };
  }

  return { ok: true, key, text: rendered.text, version: record.version, used: rendered.used };
}

/**
 * Existe e está activo?
 *
 * A guarda de publicação (item 64) precisa deste facto sem carregar o corpo do
 * template. Existe como função própria para não haver duas maneiras de
 * "verificar se o template está pronto" — uma delas acabaria por aceitar um
 * template inactivo, que é exactamente o que o item 64 proíbe.
 */
export async function messageTemplateExists(key: string): Promise<boolean> {
  const record = await prisma.messageTemplate.findUnique({ where: { key }, select: { active: true } });
  return Boolean(record?.active);
}

export async function updateMessageTemplate(key: string, input: { name?: string; body: string; active?: boolean }) {
  const user = await requireRole("ADMIN");
  const body = input.body.trim();
  if (!body) throw new Error("O corpo do template é obrigatório.");
  const existing = await prisma.messageTemplate.findUnique({ where: { key } });
  if (!existing) return notFound("Template de mensagem");
  const updated = await prisma.messageTemplate.update({
    where: { key },
    data: {
      body,
      name: input.name?.trim() || existing.name,
      active: input.active ?? existing.active,
      version: existing.version + 1,
    },
  });
  await recordAudit("MESSAGE_TEMPLATE_UPDATED", "MessageTemplate", updated.id, user.id, {
    key,
    version: updated.version,
  });
  return updated;
}

/** Usado pelo seed e porrotinas administrativas de provisionamento. */
export async function upsertMessageTemplate(input: {
  key: string;
  channel: NotificationChannel;
  name: string;
  body: string;
}) {
  return prisma.messageTemplate.upsert({
    where: { key: input.key },
    update: { name: input.name, body: input.body, channel: input.channel },
    create: { key: input.key, channel: input.channel, name: input.name, body: input.body },
  });
}

export async function listContractTemplates() {
  await requireRole("ADMIN");
  return prisma.contractTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
}

/** Tópico 24: motor de templates contratuais. */
export async function getActiveContractTemplate() {
  return prisma.contractTemplate.findFirst({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

/** Tópico 26: todos os contratos ativos, para escolha por escopo contratado. */
export async function listActiveContractTemplates() {
  return prisma.contractTemplate.findMany({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: { id: true, name: true, body: true, version: true, scopeKey: true, disciplines: true, isDefault: true },
  });
}

export async function updateContractTemplate(
  id: string,
  input: { name?: string; body: string; clauses: unknown },
) {
  const user = await requireRole("ADMIN");
  const body = input.body.trim();
  if (!body) throw new Error("O corpo do template contratual é obrigatório.");
  const existing = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!existing) return notFound("Template contratual");
  const updated = await prisma.contractTemplate.update({
    where: { id },
    data: {
      body,
      name: input.name?.trim() || existing.name,
      clauses: JSON.parse(JSON.stringify(input.clauses)) as Prisma.InputJsonValue,
      version: existing.version + 1,
    },
  });
  await recordAudit("CONTRACT_TEMPLATE_UPDATED", "ContractTemplate", updated.id, user.id, {
    version: updated.version,
  });
  return updated;
}

export { NOTIFICATION_CHANNEL };