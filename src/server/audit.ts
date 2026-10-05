import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { logError } from "@/server/observability";
import {
  AUDIT_ACTOR,
  AUDIT_OUTCOME,
  type AuditAction,
  type AuditEntity,
  type AuditOutcome,
} from "@/lib/audit-events";

/**
 * Tópico 36 — contexto de quem executa a ação.
 *
 * `actorId` sozinho não basta: uma aprovação chega pelo link público, sem
 * usuário, e mesmo assim precisa ser atribuível. `actorLabel` guarda a origem
 * legível ("Sistema", "Link do cliente") sem inventar um usuário.
 */
export type AuditActorContext = {
  actorId?: string | null;
  actorRole?: string | null;
  actorLabel?: string | null;
  /** Preenchido apenas quando a sessão do ADMIN é conhecida. */
  userId?: string | null;
};

export type AuditInput = {
  /**
   * A acção é `AuditAction`, e a comparação com `string` é o que garante que só
   * existe no catálogo.
   *
   * Isto já foi `AuditAction | string`, e a folga foi usada: `PROPOSAL_PRESENTATION_SAVED`
   * estava a ser gravado sem existir no catálogo — ou seja, uma acção que ninguém
   * decidiu auditar e sem rótulo para a interface mostrar. O `| string` foi
   * removido de propósito; reintroduzi-lo para poupar um erro de compilação seria
   * devolver o problema.
   */
  action: AuditAction;
  entity: AuditEntity | string;
  entityId?: string | null;
  /** Versão da entidade afetada — responde "qual versão" do Tópico 36. */
  entityVersion?: number | null;
  /** Estado antes e depois — responde o "estado anterior/posterior". */
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: object | null;
  outcome?: AuditOutcome;
  ipAddress?: string | null;
  requestId?: string | null;
  actor?: AuditActorContext;
};

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function actorFromUser(user: { id: string; role: string; name?: string | null } | undefined | null): AuditActorContext | undefined {
  if (!user) return undefined;
  return { actorId: user.id, actorRole: user.role, actorLabel: user.name ?? null, userId: user.id };
}

/**
 * Grava uma entrada de auditoria.
 *
 * Nunca lança: uma falha na auditoria não pode derrubar a operação de negócio
 * que a originou (aprovar uma proposta não pode falhar porque o log falhou).
 * A exceção é registada no log do servidor para haver rasto do rasto.
 * **Não é exportada**, e é de propósito: a porta única é `recordAudit`. Enquanto
 * esta função esteve exportada, os serviços chamavam-na directamente e o tipo
 * `AuditAction` deixava de ser uma garantia — passava-se uma acção fora do
 * catálogo sem o compilador dizer nada. Exportar a implementação e a interface
 * como a mesma coisa é o que mantém o catálogo a valer.
 */
async function writeAuditEntry(input: AuditInput) {
  try {
    return await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        entityVersion: input.entityVersion ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        metadata: input.metadata ? json(input.metadata) : undefined,
        outcome: input.outcome ?? AUDIT_OUTCOME.SUCCESS,
        ipAddress: input.ipAddress ?? null,
        requestId: input.requestId ?? null,
        actorId: input.actor?.actorId ?? null,
        actorRole: input.actor?.actorRole ?? null,
        actorLabel: input.actor?.actorLabel ?? null,
        userId: input.actor?.userId ?? null,
      },
    });
  } catch (error) {
    logError("audit_write_failed", error, { action: input.action, entity: input.entity, entityId: input.entityId ?? undefined });
    return null;
  }
}

/** Entrada atribuída a uma ação do sistema (automação, Tópico 37). */
export function systemActor(): AuditActorContext {
  return { actorId: AUDIT_ACTOR.SYSTEM, actorRole: AUDIT_ACTOR.SYSTEM, actorLabel: "Sistema", userId: null };
}

/** Entrada atribuída ao cliente que decidiu pelo link público. */
export function clientLinkActor(): AuditActorContext {
  return { actorId: AUDIT_ACTOR.CLIENT_LINK, actorRole: AUDIT_ACTOR.CLIENT_LINK, actorLabel: "Link do cliente", userId: null };
}

/** Entrada atribuída ao ADMIN autenticado. */
export function adminActor(user: { id: string; role: string; name?: string | null }): AuditActorContext {
  return actorFromUser(user)!;
}

/** Compatibilidade com as chamadas legadas `recordAudit(action, entity, id, userId, metadata)`. */
export async function recordLegacyAudit(
  action: AuditAction,
  entity: string,
  entityId?: string,
  userId?: string,
  metadata?: object,
) {
  return recordAudit({
    action,
    entity,
    entityId,
    metadata,
    actor: userId ? { actorId: userId, userId } : undefined,
  });
}

/**
 * Sobrecarga legada: `recordAudit(action, entity, id, userId, metadata)`.
 *
 * Mantém as 15 chamadas já existentes no projeto funcionando sem reescrita,
 * enquanto as novas usam o formato estruturado. O `userId` de administrador é
 * legado: quando o chamador tem o utilizador completo, deve passar `actor`.
 */
export function recordAudit(input: AuditInput): Promise<unknown>;
export function recordAudit(
  action: AuditAction,
  entity: string,
  entityId?: string,
  userId?: string,
  metadata?: object,
): Promise<unknown>;
export function recordAudit(
  inputOrAction: AuditInput | AuditAction,
  entity?: string,
  entityId?: string,
  userId?: string,
  metadata?: object,
) {
  if (typeof inputOrAction === "string") {
    return recordLegacyAudit(inputOrAction, entity ?? "", entityId, userId, metadata);
  }
  return writeAuditEntry(inputOrAction);
}

export type AuditTrailEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  entityVersion: number | null;
  fromStatus: string | null;
  toStatus: string | null;
  actorLabel: string | null;
  actorRole: string | null;
  outcome: string;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Tópico 36 — trilha completa de uma entidade, pronta para a interface de
 * auditoria. Ordenada do mais recente para o mais antigo.
 */
export async function listAuditTrail(entity: string, entityId: string, limit = 100): Promise<AuditTrailEntry[]> {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      entityVersion: true,
      fromStatus: true,
      toStatus: true,
      actorLabel: true,
      actorRole: true,
      outcome: true,
      metadata: true,
      createdAt: true,
    },
  });
}

