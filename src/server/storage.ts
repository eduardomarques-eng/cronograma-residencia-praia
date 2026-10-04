import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DomainError } from "@/server/errors";

/**
 * Tópico 4A — armazenamento partilhado.
 *
 * Antes isto vivia dentro de `document-service.ts` e só os documentos do
 * projecto o podiam usar. O briefing precisa de guardar imagens e áudio, e
 * recriar a configuração S3 seria um segundo sistema de armazenamento — o que o
 * enunciante proíbe explicitamente.
 *
 * Extrair para aqui não muda o comportamento de nada: as mesmas variáveis, a
 * mesma pasta local de desenvolvimento e o mesmo S3 em produção. O que muda é
 * que `document-service` e `briefing-media-service` passam a depender deste
 * módulo, e portanto a ter UM storage, não dois.
 */
export const localStorageRoot = path.join(process.cwd(), ".private-storage");

export type StorageConfig = {
  bucket: string;
  client: S3Client;
};

/** Configuração S3, ou `null` quando o storage privado não está configurado. */
export function s3Config(): StorageConfig | null {
  const bucket = process.env.STORAGE_BUCKET;
  const region = process.env.STORAGE_REGION;
  if (!bucket || !region || !process.env.STORAGE_ACCESS_KEY_ID || !process.env.STORAGE_SECRET_ACCESS_KEY) {
    return null;
  }
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: process.env.STORAGE_ENDPOINT,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      },
    }),
  };
}

/**
 * Grava um ficheiro e devolve a chave.
 *
 * Em produção sem storage configurado LANÇA. Gravar no disco de uma função
 * serverless é perder o ficheiro sem ninguém dar conta — o documento pareceria
 * guardado e desapareceria no próximo deploy.
 */
export async function putStoredObject(key: string, bytes: Buffer, contentType: string): Promise<string> {
  const config = s3Config();
  if (config) {
    await config.client.send(
      new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: contentType }),
    );
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    throw new DomainError(
      "Storage privado não configurado para produção.",
      "INTEGRITY",
    );
  }
  const destino = path.join(localStorageRoot, key);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, bytes, { flag: "wx" });
  return key;
}

/** Lê um ficheiro guardado. Lança se o storage não estiver disponível. */
export async function getStoredObject(key: string): Promise<Buffer> {
  const config = s3Config();
  if (config) {
    const result = await config.client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!result.Body) throw new DomainError("Ficheiro não encontrado no storage.", "NOT_FOUND");
    return Buffer.from(await result.Body.transformToByteArray());
  }
  try {
    return await readFile(path.join(localStorageRoot, key));
  } catch {
    throw new DomainError("Ficheiro não encontrado no storage.", "NOT_FOUND");
  }
}

/**
 * Chave de storage derivada do conteúdo.
 *
 * Inclui um hash do ficheiro: dois envios do MESMO ficheiro com o mesmo nome
 * não colidem, e não se sobrescreve nada que já lá estava.
 */
export function storageKeyFor(projectId: string, folder: string, fileName: string, digest: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `${projectId}/briefing/${folder}/${digest}-${safe}`;
}