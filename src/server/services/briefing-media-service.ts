import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { DomainError, notFound } from "@/server/errors";
import { getStoredObject, putStoredObject, storageKeyFor } from "@/server/storage";
import { resolveBriefingToken } from "./briefing-link-service";
import { transcriptionProvider } from "./transcription";
import { recordAudit, clientLinkActor, adminActor, type AuditActorContext } from "@/server/audit";
import { AUDIT_ACTION, AUDIT_ENTITY } from "@/lib/audit-events";

/**
 * Tópico 4A — Multimédia do briefing: referências visuais e áudio.
 *
 * Duas decisões que valem registar:
 *
 * 1. **Reutiliza o storage existente** (`@/server/storage`), extraído do
 *    `document-service`. Um sistema de ficheiros próprio seria exactamente o que
 *    o enunciante proíbe.
 * 2. **Autorização por token herda a do link.** Um cliente acede ao briefing por
 *    um link público cujo token é a única autorização. Para as imagens e o áudio
 *    o token continua a ser essa autorização — o `projectId` nunca substitui o
 *    token, e um token de outro briefing não devolve nada.
 */

/** Máximos por tipo. Imagens grandes travam o telemóvel do cliente. */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set(["application/pdf"]);
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
]);

export type UploadFile = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

/** Quem está a responder: sessão autenticada ou link público do cliente. */
export type BriefingAccess = { kind: "SESSION" } | { kind: "TOKEN"; token: string };

type ResolvedAccess = {
  briefing: { id: string; projectId: string; status: string };
  projectId: string;
  /** Quem está a responder — usado na auditoria. */
  actor: AuditActorContext;
};

async function requireBriefing(access: BriefingAccess, projectId?: string): Promise<ResolvedAccess> {
  if (access.kind === "TOKEN") {
    const link = await resolveBriefingToken(access.token);
    if (projectId && link.briefing.projectId !== projectId) {
      // Token válido mas de outro projecto: resposta indistinguível de "não existe".
      throw new DomainError("Briefing não encontrado.", "NOT_FOUND");
    }
    if (link.briefing.status === "FINALIZED") {
      throw new DomainError("Este briefing já foi enviado.", "CONFLICT");
    }
    return { briefing: link.briefing, projectId: link.briefing.projectId, actor: clientLinkActor() };
  }
  if (!projectId) throw new DomainError("Projecto não indicado.", "VALIDATION");
  const user = await requireProjectAccess(projectId);
  const briefing = await prisma.briefing.findUnique({ where: { projectId } });
  if (!briefing) throw notFound("Briefing");
  return { briefing, projectId, actor: adminActor(user) };
}

function assertType(file: UploadFile, allowed: Set<string>, maxBytes: number, what: string) {
  if (!file.name || file.size <= 0) {
    throw new DomainError(`O ${what} enviado está vazio.`, "VALIDATION");
  }
  if (file.size > maxBytes) {
    throw new DomainError(
      `O ${what} passa do limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      "VALIDATION",
    );
  }
  if (!allowed.has(file.type)) {
    throw new DomainError(
      `Formato de ${what} não suportado (${file.type || "desconhecido"}).`,
      "VALIDATION",
    );
  }
}

/**
 * Regista uma referência visual enviada pelo cliente.
 *
 * `likes` e `dislikes` existem para o motivo do enunciante: o cliente pode
 * gostar da iluminação de uma referência e não gostar do mobiliário. Uma imagem
 * aprovada sem isto seria lida de cima a baixo.
 */
export async function addReference(
  access: BriefingAccess,
  projectId: string | undefined,
  input: {
    questionId: string;
    file: UploadFile;
    category: string;
    caption?: string | null;
    likes?: string | null;
    dislikes?: string | null;
    environmentId?: string | null;
  },
) {
  const { briefing, projectId: resolvedProject, actor } = await requireBriefing(access, projectId);
  const isDocument = DOCUMENT_TYPES.has(input.file.type);
  assertType(input.file, isDocument ? DOCUMENT_TYPES : IMAGE_TYPES, isDocument ? 25 * 1024 * 1024 : IMAGE_MAX_BYTES, isDocument ? "documento" : "imagem");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const storageKey = storageKeyFor(
    resolvedProject,
    isDocument ? "documentos" : "referencias",
    input.file.name,
    digest,
  );
  await putStoredObject(
    storageKey.replace(`${resolvedProject}/`, ""),
    bytes,
    input.file.type,
  );

  const document = await prisma.projectDocument.create({
    data: {
      projectId: resolvedProject,
      name: input.file.name,
      storageUrl: storageKey,
      mimeType: input.file.type,
      sizeBytes: BigInt(bytes.byteLength),
      // Ficheiro do cliente no portal: visível a ele e ao ADMIN. Nunca público.
      visibility: "CLIENT",
      releasedAt: new Date(),
    },
    select: { id: true },
  });

  const reference = await prisma.briefingReference.create({
    data: {
      briefingId: briefing.id,
      questionId: input.questionId,
      storageKey,
      documentId: document.id,
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: BigInt(bytes.byteLength),
      category: input.category,
      likes: input.likes ?? null,
      dislikes: input.dislikes ?? null,
      environmentId: input.environmentId ?? null,
    },
  });

  await recordAudit({
    action: AUDIT_ACTION.DOCUMENT_STORED,
    entity: AUDIT_ENTITY.PROJECT_DOCUMENT,
    entityId: document.id,
    actor,
    metadata: { questionId: input.questionId, category: input.category, referenceId: reference.id },
  });

  return reference;
}

/** Actualiza o que o cliente disse sobre a referência, sem mexer no ficheiro. */
export async function updateReference(
  access: BriefingAccess,
  referenceId: string,
  input: { likes?: string | null; dislikes?: string | null; discarded?: boolean },
) {
  const { briefing } = await requireBriefing(access);
  const existing = await prisma.briefingReference.findFirst({
    where: { id: referenceId, briefingId: briefing.id },
    select: { id: true },
  });
  // Um id de referência de outro briefing responde como não encontrado.
  if (!existing) throw notFound("Referência");
  return prisma.briefingReference.update({
    where: { id: referenceId },
    data: {
      ...(input.likes === undefined ? {} : { likes: input.likes }),
      ...(input.dislikes === undefined ? {} : { dislikes: input.dislikes }),
      ...(input.discarded === undefined ? {} : { discarded: input.discarded }),
    },
  });
}

/**
 * Lista as referências SEM a chave de storage.
 *
 * O ficheiro é servido por uma rota própria que revalida o acesso a cada pedido;
 * a chave nunca chega ao browser.
 */
export async function listReferences(access: BriefingAccess, projectId?: string) {
  const { briefing } = await requireBriefing(access, projectId);
  return prisma.briefingReference.findMany({
    where: { briefingId: briefing.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      questionId: true,
      category: true,
      fileName: true,
      mimeType: true,
      likes: true,
      dislikes: true,
      environmentId: true,
      selected: true,
      discarded: true,
      professionalNote: true,
      createdAt: true,
    },
  });
}

/** Lê os bytes de uma referência, depois da mesma verificação de acesso. */
export async function readReferenceFile(access: BriefingAccess, referenceId: string) {
  const { briefing } = await requireBriefing(access);
  const reference = await prisma.briefingReference.findFirst({
    where: { id: referenceId, briefingId: briefing.id },
select: { storageKey: true, fileName: true, mimeType: true },
  });
if (!reference?.storageKey) throw notFound("Referência");
  return { reference, body: await getStoredObject(reference.storageKey) };
}

/**
 * Grava um áudio e pede a transcrição.
 *
 * O áudio é gravado ANTES de qualquer transcrição e nunca é apagado: se a
 * transcrição falhar, o cliente ainda ouve o que gravou e escreve à mão. É o que
 * o enunciante pede ao dizer que a transcrição não pode apagar o original.
 */
export async function addAudioNote(
  access: BriefingAccess,
  projectId: string | undefined,
  input: { questionId: string; file: UploadFile },
) {
  const { briefing, projectId: resolvedProject, actor } = await requireBriefing(access, projectId);
  assertType(input.file, AUDIO_TYPES, AUDIO_MAX_BYTES, "áudio");

  const bytes = Buffer.from(await input.file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const storageKey = storageKeyFor(resolvedProject, "audio", input.file.name, digest);
  await putStoredObject(storageKey.replace(`${resolvedProject}/`, ""), bytes, input.file.type);

  const provider = transcriptionProvider();
  const result = await provider.transcribe({
    bytes,
    mimeType: input.file.type,
    fileName: input.file.name,
  });

  const note = await prisma.briefingAudioNote.create({
    data: {
      briefingId: briefing.id,
      questionId: input.questionId,
      storageKey,
      mimeType: input.file.type,
      sizeBytes: BigInt(bytes.byteLength),
      // `TRANSCRIBED` só quando há texto real e provider real.
      status: result.ok ? "TRANSCRIBED" : "UPLOADED",
      provider: provider.name,
      transcript: result.ok ? result.text : null,
      errorMessage: result.ok ? null : result.reason,
    },
  });

  await recordAudit({
    action: AUDIT_ACTION.DOCUMENT_STORED,
    entity: AUDIT_ENTITY.PROJECT_DOCUMENT,
    entityId: note.id,
    actor,
    metadata: { questionId: input.questionId, kind: "AUDIO", transcribed: result.ok },
  });

  return note;
}

/** Texto final: o que o cliente corrigiu, ou a transcrição se não corrigiu. */
export function finalTextOf(note: {
  transcript: string | null;
  reviewedText: string | null;
}): string | null {
  return note.reviewedText?.trim() || note.transcript?.trim() || null;
}

/**
 * Guarda a revisão do texto.
 *
 * O `transcript` original NUNCA é sobrescrito: se o cliente corrigir uma palavra,
 * o que o serviço devolveu continua guardado e a consolidação distingue
 * transcrição de texto revisto.
 */
export async function reviewAudioText(access: BriefingAccess, noteId: string, reviewedText: string) {
  const { briefing } = await requireBriefing(access);
  const note = await prisma.briefingAudioNote.findFirst({
    where: { id: noteId, briefingId: briefing.id },
    select: { id: true },
  });
  if (!note) throw notFound("Áudio");
  return prisma.briefingAudioNote.update({
    where: { id: noteId },
    data: { reviewedText: reviewedText.trim(), status: "TRANSCRIBED" },
  });
}

export async function listAudioNotes(access: BriefingAccess, projectId?: string) {
  const { briefing } = await requireBriefing(access, projectId);
  return prisma.briefingAudioNote.findMany({
    where: { briefingId: briefing.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      questionId: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      provider: true,
      transcript: true,
      reviewedText: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}

/** Lê os bytes do áudio, depois da mesma verificação de acesso. */
export async function readAudioFile(access: BriefingAccess, noteId: string) {
  const { briefing } = await requireBriefing(access);
  const note = await prisma.briefingAudioNote.findFirst({
    where: { id: noteId, briefingId: briefing.id },
    select: { storageKey: true, mimeType: true },
  });
  if (!note) throw notFound("Áudio");
  return { note, body: await getStoredObject(note.storageKey) };
}

/** O ADMIN anota a referência sem alterar o que o cliente disse. */
export async function addProfessionalNote(referenceId: string, note: string) {
  await requireRole("ADMIN");
  const reference = await prisma.briefingReference.findUnique({
    where: { id: referenceId },
    select: { id: true },
  });
  if (!reference) throw notFound("Referência");
  return prisma.briefingReference.update({
    where: { id: referenceId },
    data: { professionalNote: note.trim() || null },
  });
}
