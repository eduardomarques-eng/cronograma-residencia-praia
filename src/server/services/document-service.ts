import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/server/db";
import { requireProjectAccess, requireRole } from "@/server/auth";
import { DomainError, notFound } from "@/server/errors";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "text/plain"]);
const localRoot = path.join(process.cwd(), ".private-storage");
type UploadFile = { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> };

function s3Config() {
  const bucket = process.env.STORAGE_BUCKET;
  const region = process.env.STORAGE_REGION;
  if (!bucket || !region || !process.env.STORAGE_ACCESS_KEY_ID || !process.env.STORAGE_SECRET_ACCESS_KEY) return null;
  return { bucket, client: new S3Client({ region, endpoint: process.env.STORAGE_ENDPOINT, forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true", credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY } }) };
}

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
  const config = s3Config();
  if (config) {
    await config.client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: file.type }));
  } else if (process.env.NODE_ENV === "production") {
    throw new DomainError("Storage privado não configurado para produção.", "INTEGRITY");
  } else {
    await mkdir(path.join(localRoot, projectId), { recursive: true });
    await writeFile(path.join(localRoot, key.split("/").slice(1).join("/")), bytes, { flag: "wx" });
  }
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
  const config = s3Config();
  if (config) {
    const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: document.storageUrl }));
    if (!result.Body) throw new DomainError("Arquivo não encontrado no storage.", "NOT_FOUND");
    return { document, body: Buffer.from(await result.Body.transformToByteArray()) };
  }
  const body = await readFile(path.join(localRoot, document.storageUrl));
  return { document, body };
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

  const config = s3Config();
  if (config) {
    await config.client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: storageKey, Body: bytes, ContentType: mimeType }),
    );
  } else if (process.env.NODE_ENV === "production") {
    throw new DomainError("Storage privado não configurado para produção.", "INTEGRITY");
  } else {
    await mkdir(path.join(localRoot, input.projectId, "comercial"), { recursive: true });
    await writeFile(path.join(localRoot, storageKey.replace(/^\/+/, "")), bytes, { flag: "wx" });
  }

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

