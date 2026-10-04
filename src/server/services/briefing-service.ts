import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { briefingSchema, briefingUpdateSchema } from "@/lib/validation";
import { notFound, DomainError } from "@/server/errors";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { resolveBriefingToken } from "./briefing-link-service";
import { recordAudit, type AuditActorContext } from "@/server/audit";
import {
  ANSWER_SOURCE,
  readAnswers,
  writeAnswers,
  type BriefingAnswerValue,
  type StoredAnswers,
} from "@/lib/briefing-answers";
import { allBriefingQuestions, briefingSections } from "@/lib/briefing-definition";
import {
  consolidateBriefing,
  type BriefingConsolidation,
  type BriefingReference,
} from "@/lib/briefing-consolidation";
import { briefingQuestionById } from "@/lib/briefing-definition";

function jsonResponses(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Envelope gravado. Nunca se escreve o mapa cru: só `writeAnswers` produz o
 * formato com versão, para o `readAnswers` saber o que está a ler daqui a um ano.
 */
function envelopeFor(answers: StoredAnswers) {
  return jsonResponses(writeAnswers(answers, new Date().toISOString()) as unknown as Record<string, unknown>);
}

/** Respostas guardadas de um briefing, já convertidas do formato legado. */
export function answersOf(briefing: { responses: unknown; updatedAt: Date }): StoredAnswers {
  return readAnswers(briefing.responses, briefing.updatedAt.toISOString());
}

export async function startBriefing(projectId: string) {
  await requireProjectAccess(projectId);
  return prisma.briefing.upsert({
    where: { projectId },
    create: { projectId, responses: {} },
    update: {},
  });
}

export async function getBriefing(projectId: string) {
  await requireProjectAccess(projectId);
  return (await prisma.briefing.findUnique({ where: { projectId }, include: { revisions: { orderBy: { version: "desc" } } } })) ?? notFound("Briefing");
}

export async function saveBriefingResponses(projectId: string, input: unknown) {
  await requireProjectAccess(projectId);
  const existing = await prisma.briefing.findUnique({ where: { projectId }, select: { status: true, responses: true, updatedAt: true } });
  if (existing?.status === "FINALIZED") {
    throw new DomainError("Este briefing já foi finalizado e precisa ser reaberto pelo administrador.", "CONFLICT");
  }
  const data = briefingSchema.omit({ projectId: true }).parse(input);
  const previous = existing ? answersOf({ responses: existing.responses, updatedAt: existing.updatedAt }) : {};
  const next = mergeAnswers(previous, data.responses as StoredAnswers);
  return prisma.briefing.upsert({
    where: { projectId },
    create: { projectId, ...data, responses: envelopeFor(next) },
    update: { ...data, responses: envelopeFor(next) },
  });
}

/**
 * Junta as respostas recebidas às que já estavam guardadas.
 *
 * Um autosave envia um subconjunto (o cliente mudou uma resposta, não todas). Se
 * substituíssemos o mapa inteiro, cada tecla apagaria as respostas das outras
 * perguntas. Fundir é o que permite "continuar depois" sem perder nada.
 */
export function mergeAnswers(current: StoredAnswers, incoming: StoredAnswers): StoredAnswers {
  const merged: StoredAnswers = { ...current };
  for (const [questionId, value] of Object.entries(incoming)) {
    if (!briefingQuestionById.has(questionId)) continue;
    merged[questionId] = {
      value: value.value,
      // Uma resposta do cliente nunca é rebaixada a inferência, e oAdmin não
      // escreve por cima do que o cliente disse sem deixar rasto.
      source: value.source ?? ANSWER_SOURCE.CLIENT,
      updatedAt: value.updatedAt ?? new Date().toISOString(),
      professionalNote: value.professionalNote ?? current[questionId]?.professionalNote ?? null,
    };
  }
  return merged;
}

/**
 * Regista quem respondeu, quando, e o que mudou.
 *
 * Só regista quando o valor mudou de facto: um autosave que reenvia o mesmo
 * conteúdo não deve encher a trilha de ruído que o profissional teria de ler.
 *
 * `actor` vem do chamador porque quem respondeu pode ser o ADMIN na sessão ou o
 * cliente pelo link público — são origens diferentes e a auditoria tem de as
 * distinguir.
 */
export async function auditAnswerChange(input: {
  briefingId: string;
  questionId: string;
  before: unknown;
  after: unknown;
  actor: AuditActorContext;
  entityVersion?: number | null;
}) {
  if (JSON.stringify(input.before ?? null) === JSON.stringify(input.after ?? null)) return;
  await recordAudit({
    action: "BRIEFING_ANSWER_SAVED",
    entity: "Briefing",
    entityId: input.briefingId,
    entityVersion: input.entityVersion ?? null,
    actor: input.actor,
    metadata: { questionId: input.questionId, before: input.before ?? null, after: input.after ?? null },
  });
}

/**
 * Consolidação de um briefing, com as referências visuais já persistidas.
 *
 * É o que a Fase 4B consome: programa de necessidades, objectivos, restrições,
 * orçamento, prazo, serviços e pendências, todos lidos do que o cliente
 * respondeu.
 */
export async function getConsolidatedBriefing(projectId: string): Promise<BriefingConsolidation | null> {
  await requireProjectAccess(projectId);
  const briefing = await prisma.briefing.findUnique({
    where: { projectId },
    include: { references: { orderBy: { createdAt: "asc" } } },
  });
  if (!briefing) return null;

  const references: BriefingReference[] = briefing.references.map((reference) => ({
    id: reference.id,
    category: reference.category,
    fileName: reference.fileName,
    likes: reference.likes,
    dislikes: reference.dislikes,
    selected: reference.selected,
    discarded: reference.discarded,
    professionalNote: reference.professionalNote,
  }));

  return consolidateBriefing({
    answers: answersOf(briefing),
    questions: allBriefingQuestions,
    sections: briefingSections,
    references,
  });
}

export async function updateBriefing(projectId: string, input: unknown) {
  await requireRole("ADMIN");
  const data = briefingUpdateSchema.parse(input);
  const { responses, ...rest } = data;
  const existing = await prisma.briefing.findUnique({
    where: { projectId },
    select: { id: true, responses: true, updatedAt: true },
  });
  if (!existing) return notFound("Briefing");

  // O ADMIN acrescenta NOTA PROFISSIONAL; não substitui a resposta do cliente.
  // `source` passa a DERIVED para deixar claro que a informação é do estúdio.
  const merged =
    responses === undefined
      ? undefined
      : envelopeFor(
          mergeAnswers(
            answersOf(existing),
            Object.fromEntries(
              Object.entries(responses as Record<string, unknown>).map(([questionId, value]) => [
                questionId,
                {
                  value,
                  source: ANSWER_SOURCE.DERIVED,
                  updatedAt: new Date().toISOString(),
                } satisfies BriefingAnswerValue,
              ]),
            ) as StoredAnswers,
          ),
        );

  return prisma.briefing.update({
    where: { projectId },
    data: { ...rest, ...(merged === undefined ? {} : { responses: merged }) },
    select: { id: true, projectId: true, status: true, version: true },
  });
}

export async function finishBriefing(projectId: string) {
  await requireProjectAccess(projectId);
  const briefing = await prisma.briefing.findUnique({ where: { projectId } });
  if (!briefing) return notFound("Briefing");
  if (briefing.status === "FINALIZED") return briefing;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.briefingRevision.create({ data: { briefingId: briefing.id, version: briefing.version, responses: jsonResponses((briefing.responses ?? {}) as Record<string, unknown>) } });
    return tx.briefing.update({ where: { projectId }, data: { submittedAt: now, finalizedAt: now, status: "FINALIZED" } });
  });
}

export async function getBriefingByToken(token: string) {
  const link = await resolveBriefingToken(token);
  return link.briefing;
}

export async function saveBriefingResponsesByToken(token: string, input: unknown) {
  const link = await resolveBriefingToken(token);
  if (link.briefing.status === "FINALIZED") {
    throw new DomainError("Este briefing já foi enviado.", "CONFLICT");
  }
  const data = briefingSchema.omit({ projectId: true }).parse(input);
  // Mesma fusão da rota autenticada: um autosave parcial nunca apaga o resto.
  const merged = mergeAnswers(
    answersOf(link.briefing),
    data.responses as StoredAnswers,
  );
  return prisma.briefing.update({
    where: { id: link.briefing.id },
    data: { responses: envelopeFor(merged) },
    select: { id: true, projectId: true, status: true, version: true },
  });
}

export async function finishBriefingByToken(token: string) {
  const link = await resolveBriefingToken(token);
  if (link.briefing.status === "FINALIZED") return link.briefing;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.briefingRevision.create({ data: { briefingId: link.briefing.id, version: link.briefing.version, responses: jsonResponses((link.briefing.responses ?? {}) as Record<string, unknown>) } });
    return tx.briefing.update({ where: { id: link.briefing.id }, data: { submittedAt: now, finalizedAt: now, status: "FINALIZED" } });
  });
}

export async function reopenBriefing(projectId: string) {
  await requireRole("ADMIN");
  return prisma.briefing.update({ where: { projectId }, data: { status: "DRAFT", submittedAt: null, finalizedAt: null, version: { increment: 1 } } });
}

export async function listVisualOptions(questionId?: string) {
  await requireRole("ADMIN");
  return prisma.briefingVisualOption.findMany({ where: questionId ? { questionId } : undefined, orderBy: [{ questionId: "asc" }, { sortOrder: "asc" }] });
}

export async function saveVisualOption(input: {
  id?: string;
  questionId: string;
  value: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
  sortOrder?: number;
  active?: boolean;
}) {
  await requireRole("ADMIN");
  const { id, ...data } = input;
  return id
    ? prisma.briefingVisualOption.update({ where: { id }, data })
    : prisma.briefingVisualOption.create({ data });
}

export async function removeVisualOption(id: string) {
  await requireRole("ADMIN");
  return prisma.briefingVisualOption.delete({ where: { id } });
}
