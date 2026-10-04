import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { DomainError, notFound } from "@/server/errors";
import {
  getStoredObject,
  localStorageRoot,
  putStoredObject,
  s3Config,
} from "@/server/storage";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
type UploadFile = { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };

function assertFile(file: UploadFile) {
  if (!file.name || file.size <= 0 || file.size > MAX_BYTES) throw new DomainError("O arquivo deve ter entre 1 byte e 10 MB.", "VALIDATION");
  if (!ALLOWED_TYPES.has(file.type)) throw new DomainError("Tipo de arquivo não permitido. Use PDF, PNG, JPG ou TXT.", "VALIDATION");
}

export async function listProjectDocuments(projectId: string, clientVisible = false) {
  if (clientVisible) await requireProjectAccess(projectId);
  else await requireRole("ADMIN");
  return prisma.projectDocument.findMany({
    where: { projectId, status: "ACTIVE", ...(clientVisible ? { visibility: "CLIENT" } : {}) },
    select: { id: true, name: true, mimeType: true, sizeBytes: true, visibility: true, createdAt: true, releasedAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function uploadProjectDocument(projectId: string, file: UploadFile, visibility: "INTERNAL" | "CLIENT") {
  await requireRole("ADMIN");
  assertFile(file);
  const key = `${projectId}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  // A chave já traz o id do projecto; o `putStoredObject` resolve o resto.
  await putStoredObject(key.replace(`${projectId}/`, ""), bytes, file.type);
  return prisma.projectDocument.create({ data: { projectId, name: file.name, storageUrl: key, mimeType: file.type, sizeBytes: file.size, visibility, releasedAt: visibility === "CLIENT" ? new Date() : null } });
}

export async function archiveProjectDocument(id: string) {
  await requireRole("ADMIN");
  const document = await prisma.projectDocument.findUnique({ where: { id } });
  if (!document) return notFound("Documento");
  return prisma.projectDocument.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
}

export async function downloadProjectDocument(id: string) {
  const document = await prisma.projectDocument.findUnique({ where: { id } });
  if (!document || document.status !== "ACTIVE") return notFound("Documento");
  const user = await requireProjectAccess(document.projectId);
  if (user.role !== "ADMIN" && document.visibility !== "CLIENT") return notFound("Documento");
  return { document, body: await getStoredObject(document.storageUrl) };
}

type StoredCommercialDocument = {
  projectId: string;
  name: string;
  /** Texto já renderizado; o módulo de documentos grava no storage de sempre. */
  text: string;
  mimeType?: string;
  source: "PROPOSAL" | "CONTRACT" | "CONTRACT_SIGNED" | "PAYMENT_RECEIPT";
  proposalId?: string | null;
  contractId?: string | null;
  /** Chave estável que impede gravar o mesmo artefato duas vezes. */
  sourceKey: string;
  visibility?: "INTERNAL" | "CLIENT";
};

/**
 * Tópico 39 — guarda um artefato comercial no MÓDULO DE DOCUMENTOS EXISTENTE.
 *
 * Não existe um segundo sistema de armazenamento: reutiliza exatamente o
 * mesmo `s3Config()`/`localRoot` e a mesma tabela `ProjectDocument` já
 * consultada pelo portal do cliente. O que muda são apenas três colunas de
 * rastreio (`source`, `proposalId`/`contractId`, `sourceKey`).
 *
 * A gravação é idempotente por `sourceKey`: reexecutar a conversão devolve o
 * documento já existente em vez de criar um duplicado.
 */
export async function storeCommercialDocument(input: StoredCommercialDocument) {
  await requireRole("ADMIN");

  // Chave já usada: o artefato existe. Devolvemos o registo atual.
  const existing = await prisma.projectDocument.findUnique({ where: { sourceKey: input.sourceKey } });
  if (existing) return { document: existing, created: false };

  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) return notFound("Projeto");

  const mimeType = input.mimeType ?? "text/plain";
  const bytes = Buffer.from(input.text, "utf8");
  const storageKey = `${input.projectId}/comercial/${input.sourceKey.replace(/[^a-zA-Z0-9._-]/g, "_")}.txt`;

  await putStoredObject(storageKey.replace(`${input.projectId}/`, ""), bytes, mimeType);

  try {
    const document = await prisma.projectDocument.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        storageUrl: storageKey,
        mimeType,
        sizeBytes: BigInt(bytes.byteLength),
        source: input.source,
        proposalId: input.proposalId ?? null,
        contractId: input.contractId ?? null,
        sourceKey: input.sourceKey,
        visibility: input.visibility ?? "INTERNAL",
        releasedAt: (input.visibility ?? "INTERNAL") === "CLIENT" ? new Date() : null,
      },
    });
    return { document, created: true };
  } catch (error) {
    // Corrida entre duas execuções: o índice único decidiu, e o resultado
    // correto é o documento que a outra execução gravou.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const document = await prisma.projectDocument.findUnique({ where: { sourceKey: input.sourceKey } });
      if (document) return { document, created: false };
    }
    throw error;
  }
}

